import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execCommand } from "../src/executor.js";

const TMP_DIR = join(tmpdir(), "safe-exec-test-" + process.pid);
const DISPATCHER = join(TMP_DIR, "test-dispatcher.sh");

describe("execCommand", () => {
  before(async () => {
    await mkdir(TMP_DIR, { recursive: true });
    // Create a test dispatcher script
    await writeFile(
      DISPATCHER,
      [
        "#!/bin/bash",
        'APP="$1"; CMD="$2"; shift 2',
        'if [ "$APP" = "echo" ] && [ "$CMD" = "hello" ]; then',
        '  echo "Hello, world!"',
        '  exit 0',
        "fi",
        'if [ "$APP" = "echo" ] && [ "$CMD" = "args" ]; then',
        '  echo "$@"',
        '  exit 0',
        "fi",
        'if [ "$APP" = "fail" ] && [ "$CMD" = "exit2" ]; then',
        '  echo "something went wrong" >&2',
        "  exit 2",
        "fi",
        'if [ "$APP" = "slow" ] && [ "$CMD" = "hang" ]; then',
        "  sleep 60",
        "  exit 0",
        "fi",
        'if [ "$APP" = "stderr" ] && [ "$CMD" = "warn" ]; then',
        '  echo "stdout line"',
        '  echo "stderr line" >&2',
        "  exit 0",
        "fi",
        "exit 127",
      ].join("\n"),
      "utf-8",
    );
    await writeFile(join(TMP_DIR, "chmod.flag"), "", "utf-8");
    const { execSync } = await import("node:child_process");
    execSync(`chmod +x "${DISPATCHER}"`);
  });

  after(async () => {
    try {
      const { rm } = await import("node:fs/promises");
      await rm(TMP_DIR, { recursive: true, force: true });
    } catch {
      // cleanup best-effort
    }
  });

  it("resolves with exitCode 0 and stdout on success", async () => {
    const result = await execCommand(DISPATCHER, "echo", "hello");
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "Hello, world!");
    assert.equal(result.stderr, "");
  });

  it("passes extra args to dispatcher", async () => {
    const result = await execCommand(DISPATCHER, "echo", "args", [
      "foo",
      "bar",
    ]);
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "foo bar");
  });

  it("resolves with non-zero exitCode on command failure", async () => {
    const result = await execCommand(DISPATCHER, "fail", "exit2");
    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /something went wrong/);
  });

  it("captures both stdout and stderr", async () => {
    const result = await execCommand(DISPATCHER, "stderr", "warn");
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "stdout line");
    assert.equal(result.stderr, "stderr line");
  });

  it("rejects on timeout", async () => {
    await assert.rejects(
      () =>
        execCommand(DISPATCHER, "slow", "hang", [], { timeoutMs: 200 }),
      /timed out/,
    );
  });

  it("rejects with spawn error for non-existent dispatcher", async () => {
    await assert.rejects(
      () => execCommand("/nonexistent/path/dispatcher.sh", "app", "cmd"),
      /Spawn failed \[ENOENT\]/,
    );
  });

  it("returns numeric exitCode (not string) for process errors", async () => {
    const result = await execCommand(DISPATCHER, "unknown", "cmd");
    assert.equal(typeof result.exitCode, "number");
    assert.equal(result.exitCode, 127);
  });
});
