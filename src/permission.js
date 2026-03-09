import { debug } from "./debug.js";

/**
 * Whitelist-based permission checking for agent commands.
 *
 * Allowed patterns:
 *   - "app:cmd"  — exact match
 *   - "app:*"    — any command under that app
 */

/**
 * Parse a whitelist entry into { app, cmd } where cmd may be "*".
 * @param {string} entry - e.g. "nomachine:status" or "firewall:*"
 * @returns {{ app: string, cmd: string }}
 */
function parseEntry(entry) {
  const sep = entry.indexOf(":");
  if (sep === -1) {
    return { app: entry, cmd: "*" };
  }
  return {
    app: entry.slice(0, sep),
    cmd: entry.slice(sep + 1),
  };
}

/**
 * Check whether `app:cmd` is allowed by the given whitelist.
 * @param {string[]} allowList - e.g. ["nomachine:*", "firewall:status"]
 * @param {string} app
 * @param {string} cmd
 * @returns {boolean}
 */
export function isAllowed(allowList, app, cmd) {
  if (!Array.isArray(allowList) || allowList.length === 0) {
    debug("isAllowed: empty allowList → DENY");
    return false;
  }
  const result = allowList.some((entry) => {
    const rule = parseEntry(entry);
    if (rule.app !== app) return false;
    debug("isAllowed: matched rule", entry, "for", `${app}:${cmd}`);
    return rule.cmd === "*" || rule.cmd === cmd;
  });
  debug("isAllowed:", `${app}:${cmd}`, "→", result ? "ALLOW" : "DENY");
  return result;
}
