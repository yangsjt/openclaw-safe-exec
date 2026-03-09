import { isAllowed } from "./permission.js";
import { execCommand } from "./executor.js";
import { audit } from "./audit.js";
import { debug } from "./debug.js";

const MAX_STDERR_CHARS = 2000;
const MIN_SUBSTR_KEY_LEN = 3;

/**
 * Resolve agent permissions: exact match first, then longest substring match.
 * Handles dynamic agent IDs like "channel-alice-dm-0000000000" → config key "alice".
 */
function resolveAgentPerms(agents, agentId) {
  if (!agents) return null;
  if (agents[agentId]) {
    debug("resolveAgentPerms: exact match", agentId);
    return agents[agentId];
  }

  let best = null;
  let bestLen = 0;
  for (const key of Object.keys(agents)) {
    if (key.length < MIN_SUBSTR_KEY_LEN) continue;
    if (agentId.includes(key) && key.length > bestLen) {
      debug("resolveAgentPerms: substring candidate", key, "len=", key.length);
      best = agents[key];
      bestLen = key.length;
    }
  }
  debug("resolveAgentPerms:", best ? `matched "${agentId}" → key len=${bestLen}` : `no match for "${agentId}"`);
  return best;
}

/**
 * Tool Factory — creates a safe_exec tool scoped to the calling agent.
 *
 * @param {object} api - OpenClaw plugin API
 * @param {object} ctx - OpenClawPluginToolContext (contains agentId)
 * @returns {object|null} Tool definition, or null if agent has no permissions
 */
export function createSafeExecTool(api, ctx) {
  const agentId = ctx.agentId;
  const pluginCfg = api.pluginConfig ?? {};
  const agentPerms = resolveAgentPerms(pluginCfg.agents, agentId);

  debug("createSafeExecTool: agentId=", agentId, "dispatcher=", pluginCfg.dispatcher, "sudoApps=", pluginCfg.sudoApps);

  // Agent not configured — don't register the tool
  if (!agentPerms) {
    debug("createSafeExecTool: no perms for", agentId, "— tool not registered");
    return null;
  }

  // Validate allow list type (guard against "allow": "nomachine:*" instead of array)
  if (!Array.isArray(agentPerms.allow)) {
    debug("createSafeExecTool: agentPerms.allow is not an array for", agentId, "— tool not registered");
    return null;
  }

  const dispatcher = pluginCfg.dispatcher;

  // Validate dispatcher path
  if (typeof dispatcher !== "string" || !dispatcher) {
    debug("createSafeExecTool: dispatcher is missing or invalid — tool not registered");
    return null;
  }
  const sudoApps = pluginCfg.sudoApps ?? [];
  const auditLog = pluginCfg.auditLog
    ? pluginCfg.auditLog.replace(/^~/, process.env.HOME)
    : null;

  return {
    name: "safe_exec",
    description:
      "Execute whitelisted system commands via dispatcher. Use app + cmd params. Response starts with 'Command succeeded' or 'Command failed'.",
    parameters: {
      type: "object",
      properties: {
        app: {
          type: "string",
          description: `App name, e.g. ${[...new Set(agentPerms.allow.map((r) => r.split(":")[0]))].join(", ")}`,
        },
        cmd: {
          type: "string",
          description: "Sub-command, e.g. status, restart, start, stop, logs",
        },
        args: {
          type: "array",
          items: { type: "string" },
          description: "Additional arguments (optional)",
        },
      },
      required: ["app", "cmd"],
    },

    async execute(_id, params) {
      const { app, cmd, args = [] } = params;

      // Input validation
      if (typeof app !== "string" || !app) {
        throw new Error("Parameter 'app' must be a non-empty string");
      }
      if (typeof cmd !== "string" || !cmd) {
        throw new Error("Parameter 'cmd' must be a non-empty string");
      }
      if (!Array.isArray(args) || !args.every((a) => typeof a === "string")) {
        throw new Error("Parameter 'args' must be an array of strings");
      }

      debug("execute:", agentId, `${app} ${cmd}`, "args=", args);

      // 1. Whitelist check
      if (!isAllowed(agentPerms.allow, app, cmd)) {
        await audit(auditLog, agentId, "DENY", `${app} ${cmd}`);
        throw new Error(`Agent "${agentId}" not authorized to run: ${app} ${cmd}`);
      }

      // 2. Audit — allowed
      await audit(auditLog, agentId, "ALLOW", `${app} ${cmd}`);

      // 3. Execute
      const needsSudo = sudoApps.includes(app);
      debug("execute: allowed, sudo=", needsSudo);
      const result = await execCommand(dispatcher, app, cmd, args, {
        sudo: needsSudo,
      });

      // 4. Audit — result
      await audit(
        auditLog,
        agentId,
        "RESULT",
        `${app} ${cmd}`,
        `exit=${result.exitCode}`,
      );

      // 5. Return structured result
      const output = result.stdout || "(no output)";
      const truncatedStderr =
        result.stderr.length > MAX_STDERR_CHARS
          ? result.stderr.slice(0, MAX_STDERR_CHARS) + "\n… (stderr truncated)"
          : result.stderr;

      let text;
      if (result.exitCode === 0) {
        text = `Command succeeded (exit=0)\n\n${output}`;
      } else {
        const parts = [`Command failed (exit=${result.exitCode})`];
        if (output !== "(no output)") parts.push(`\nstdout:\n${output}`);
        if (truncatedStderr) parts.push(`\nstderr:\n${truncatedStderr}`);
        text = parts.join("\n");
      }

      return {
        content: [{ type: "text", text }],
        details: {
          exitCode: result.exitCode,
          stderr: truncatedStderr,
        },
      };
    },
  };
}
