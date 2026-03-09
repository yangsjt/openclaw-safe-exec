import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { writeFile, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSafeExecTool } from "../src/safe-exec-tool.js";

const TMP_DIR = join(tmpdir(), "safe-exec-integration-" + process.pid);
const DISPATCHER = join(TMP_DIR, "dispatcher.sh");
const AUDIT_LOG = join(TMP_DIR, "audit.log");

function makeApi(overrides = {}) {
  return {
    pluginConfig: {
      dispatcher: DISPATCHER,
      sudoApps: [],
      auditLog: AUDIT_LOG,
      agents: {
        testbot: { allow: ["echo:*", "fail:exit2"] },
      },
      ...overrides,
    },
  };
}

describe("integration: createSafeExecTool → execute → audit", () => {
  before(async () => {
    await mkdir(TMP_DIR, { recursive: true });
    await writeFile(
      DISPATCHER,
      [
        "#!/bin/bash",
        'APP="$1"; CMD="$2"; shift 2',
        'if [ "$APP" = "echo" ] && [ "$CMD" = "hello" ]; then',
        '  echo "Hello from dispatcher"',
        "  exit 0",
        "fi",
        'if [ "$APP" = "fail" ] && [ "$CMD" = "exit2" ]; then',
        '  echo "error output" >&2',
        "  exit 2",
        "fi",
        "exit 127",
      ].join("\n"),
      "utf-8",
    );
    const { execSync } = await import("node:child_process");
    execSync(`chmod +x "${DISPATCHER}"`);
  });

  after(async () => {
    try {
      await rm(TMP_DIR, { recursive: true, force: true });
    } catch {
      // cleanup best-effort
    }
  });

  it("authorized command → succeeded response + audit ALLOW + RESULT", async () => {
    const api = makeApi();
    const tool = createSafeExecTool(api, { agentId: "testbot" });
    assert.notEqual(tool, null);

    const response = await tool.execute("call-1", {
      app: "echo",
      cmd: "hello",
    });

    // Verify response format
    assert.equal(response.content[0].type, "text");
    assert.match(response.content[0].text, /^Command succeeded \(exit=0\)\n\nHello from dispatcher$/);
    assert.equal(response.details.exitCode, 0);

    // Verify audit log
    const log = await readFile(AUDIT_LOG, "utf-8");
    const lines = log.trim().split("\n");
    assert.ok(lines.some((l) => l.includes("ALLOW") && l.includes("echo hello")));
    assert.ok(lines.some((l) => l.includes("RESULT") && l.includes("exit=0")));
  });

  it("denied command → throws + audit DENY", async () => {
    const api = makeApi();
    const tool = createSafeExecTool(api, { agentId: "testbot" });

    await assert.rejects(
      () => tool.execute("call-2", { app: "secret", cmd: "delete" }),
      /not authorized/,
    );

    const log = await readFile(AUDIT_LOG, "utf-8");
    assert.ok(log.includes("DENY") && log.includes("secret delete"));
  });

  it("failed command → Command failed response + correct exitCode", async () => {
    const api = makeApi();
    const tool = createSafeExecTool(api, { agentId: "testbot" });

    const response = await tool.execute("call-3", {
      app: "fail",
      cmd: "exit2",
    });

    assert.match(response.content[0].text, /Command failed \(exit=2\)/);
    assert.equal(response.details.exitCode, 2);
    assert.match(response.details.stderr, /error output/);

    const log = await readFile(AUDIT_LOG, "utf-8");
    assert.ok(log.includes("RESULT") && log.includes("exit=2"));
  });
});
