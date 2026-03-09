import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { audit } from "../src/audit.js";

const TMP_DIR = join(tmpdir(), "safe-exec-audit-test-" + process.pid);

describe("audit", () => {
  before(async () => {
    await mkdir(TMP_DIR, { recursive: true });
  });

  after(async () => {
    try {
      await rm(TMP_DIR, { recursive: true, force: true });
    } catch {
      // cleanup best-effort
    }
  });

  it("writes correct format to log file", async () => {
    const logPath = join(TMP_DIR, "format.log");
    await audit(logPath, "testAgent", "ALLOW", "nomachine status");

    const content = await readFile(logPath, "utf-8");
    const line = content.trim();
    // Format: ISO8601 | agentId (padded) | verdict (padded) | detail
    assert.match(line, /^\d{4}-\d{2}-\d{2}T/); // ISO timestamp
    assert.match(line, /\| testAgent\s+\|/); // padded agentId
    assert.match(line, /\| ALLOW\s+\|/); // padded verdict
    assert.match(line, /\| nomachine status$/); // detail at end
  });

  it("appends multiple entries", async () => {
    const logPath = join(TMP_DIR, "multi.log");
    await audit(logPath, "agent1", "ALLOW", "app1 cmd1");
    await audit(logPath, "agent2", "DENY", "app2 cmd2");
    await audit(logPath, "agent1", "RESULT", "app1 cmd1", "exit=0");

    const content = await readFile(logPath, "utf-8");
    const lines = content.trim().split("\n");
    assert.equal(lines.length, 3);
    assert.match(lines[0], /ALLOW/);
    assert.match(lines[1], /DENY/);
    assert.match(lines[2], /RESULT/);
  });

  it("includes extra field when provided", async () => {
    const logPath = join(TMP_DIR, "extra.log");
    await audit(logPath, "agent", "RESULT", "nomachine status", "exit=0");

    const content = await readFile(logPath, "utf-8");
    assert.match(content, /\| exit=0/);
  });

  it("silently returns when logPath is null or undefined", async () => {
    // Should not throw
    await audit(null, "agent", "ALLOW", "app cmd");
    await audit(undefined, "agent", "ALLOW", "app cmd");
  });

  it("auto-creates parent directories", async () => {
    const logPath = join(TMP_DIR, "nested", "deep", "audit.log");
    await audit(logPath, "agent", "ALLOW", "app cmd");

    const content = await readFile(logPath, "utf-8");
    assert.match(content, /ALLOW/);
  });

  it("does not throw on write failure", async () => {
    // Use a path that will fail (directory as file)
    const logPath = join(TMP_DIR, "nested"); // "nested" is a directory from previous test
    // Writing to a directory path should fail but not throw
    await audit(logPath, "agent", "ALLOW", "app cmd");
    // If we get here, it didn't throw — that's the test
  });
});
