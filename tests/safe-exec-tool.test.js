import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createSafeExecTool } from "../src/safe-exec-tool.js";

function makeApi(config) {
  return { pluginConfig: config };
}

const baseConfig = {
  dispatcher: "/usr/local/bin/dispatcher.sh",
  sudoApps: ["nomachine", "firewall"],
  auditLog: null, // disable audit in tests
  agents: {
    alice: {
      allow: ["nomachine:*", "firewall:*", "sunshine:status"],
    },
    bob: {
      allow: ["docs:*", "obsidian:*"],
    },
  },
};

describe("createSafeExecTool", () => {
  it("returns null for unknown agent", () => {
    const api = makeApi(baseConfig);
    const tool = createSafeExecTool(api, { agentId: "unknown" });
    assert.equal(tool, null);
  });

  it("returns null when agent has no config", () => {
    const api = makeApi({ ...baseConfig, agents: {} });
    const tool = createSafeExecTool(api, { agentId: "alice" });
    assert.equal(tool, null);
  });

  it("creates tool for configured agent", () => {
    const api = makeApi(baseConfig);
    const tool = createSafeExecTool(api, { agentId: "alice" });
    assert.notEqual(tool, null);
    assert.equal(tool.name, "safe_exec");
    assert.equal(typeof tool.execute, "function");
  });

  it("has correct parameter schema", () => {
    const api = makeApi(baseConfig);
    const tool = createSafeExecTool(api, { agentId: "alice" });
    const props = tool.parameters.properties;
    assert.ok(props.app);
    assert.ok(props.cmd);
    assert.ok(props.args);
    assert.deepEqual(tool.parameters.required, ["app", "cmd"]);
  });

  it("rejects unauthorized command", async () => {
    const api = makeApi(baseConfig);
    const tool = createSafeExecTool(api, { agentId: "bob" });
    await assert.rejects(
      () => tool.execute("call-1", { app: "firewall", cmd: "status" }),
      /not authorized/,
    );
  });

  it("rejects unauthorized app for bob", async () => {
    const api = makeApi(baseConfig);
    const tool = createSafeExecTool(api, { agentId: "bob" });
    await assert.rejects(
      () => tool.execute("call-2", { app: "nomachine", cmd: "restart" }),
      /not authorized/,
    );
  });

  it("resolves dynamic agentId to base agent config", () => {
    const api = makeApi(baseConfig);
    const tool = createSafeExecTool(api, { agentId: "channel-alice-dm-0000000000" });
    assert.notEqual(tool, null);
    assert.equal(tool.name, "safe_exec");
  });

  it("resolves bob dynamic agentId", () => {
    const api = makeApi(baseConfig);
    const tool = createSafeExecTool(api, { agentId: "channel-bob-dm-0000000000" });
    assert.notEqual(tool, null);
    assert.equal(tool.name, "safe_exec");
  });

  it("still returns null for unknown dynamic agentId", () => {
    const api = makeApi(baseConfig);
    const tool = createSafeExecTool(api, { agentId: "channel-unknown-dm-999" });
    assert.equal(tool, null);
  });

  it("prefers longest matching key", () => {
    const config = {
      ...baseConfig,
      agents: {
        bo: { allow: ["docs:status"] },
        bob: { allow: ["docs:*", "obsidian:*"] },
      },
    };
    const api = makeApi(config);
    const tool = createSafeExecTool(api, { agentId: "channel-bob-dm-123" });
    assert.notEqual(tool, null);
    // bob has docs:* — should not reject
    // bo only has docs:status — if matched bo, obsidian would fail
    assert.ok(tool.parameters.properties.app.description.includes("obsidian"));
  });

  // Phase 2A: allow type validation
  it("returns null when allow is not an array", () => {
    const config = {
      ...baseConfig,
      agents: { badagent: { allow: "nomachine:*" } },
    };
    const api = makeApi(config);
    const tool = createSafeExecTool(api, { agentId: "badagent" });
    assert.equal(tool, null);
  });

  // Phase 2B: dispatcher validation
  it("returns null when dispatcher is missing", () => {
    const config = { ...baseConfig, dispatcher: undefined };
    const api = makeApi(config);
    const tool = createSafeExecTool(api, { agentId: "alice" });
    assert.equal(tool, null);
  });

  it("returns null when dispatcher is empty string", () => {
    const config = { ...baseConfig, dispatcher: "" };
    const api = makeApi(config);
    const tool = createSafeExecTool(api, { agentId: "alice" });
    assert.equal(tool, null);
  });

  // Phase 3A: min substring key length
  it("skips substring keys shorter than 3 characters", () => {
    const config = {
      ...baseConfig,
      agents: {
        li: { allow: ["dangerous:*"] },
      },
    };
    const api = makeApi(config);
    const tool = createSafeExecTool(api, {
      agentId: "channel-alice-dm-123",
    });
    assert.equal(tool, null); // "li" is too short for substring match
  });

  // Phase 1B: input validation
  it("rejects empty app parameter", async () => {
    const api = makeApi(baseConfig);
    const tool = createSafeExecTool(api, { agentId: "alice" });
    await assert.rejects(
      () => tool.execute("call-1", { app: "", cmd: "status" }),
      /Parameter 'app' must be a non-empty string/,
    );
  });

  it("rejects null cmd parameter", async () => {
    const api = makeApi(baseConfig);
    const tool = createSafeExecTool(api, { agentId: "alice" });
    await assert.rejects(
      () => tool.execute("call-1", { app: "nomachine", cmd: null }),
      /Parameter 'cmd' must be a non-empty string/,
    );
  });

  it("rejects non-string args", async () => {
    const api = makeApi(baseConfig);
    const tool = createSafeExecTool(api, { agentId: "alice" });
    await assert.rejects(
      () =>
        tool.execute("call-1", {
          app: "nomachine",
          cmd: "status",
          args: [123],
        }),
      /Parameter 'args' must be an array of strings/,
    );
  });
});
