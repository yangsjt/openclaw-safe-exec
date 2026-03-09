import { execFile } from "node:child_process";
import { debug } from "./debug.js";

/**
 * Execute a dispatcher command, optionally with sudo.
 *
 * @param {string} dispatcher - Absolute path to the dispatcher script
 * @param {string} app        - App name (e.g. "nomachine")
 * @param {string} cmd        - Sub-command (e.g. "status")
 * @param {string[]} args     - Additional arguments
 * @param {{ sudo?: boolean, timeoutMs?: number }} opts
 * @returns {Promise<{ exitCode: number, stdout: string, stderr: string }>}
 */
export function execCommand(dispatcher, app, cmd, args = [], opts = {}) {
  const { sudo = false, timeoutMs = 30_000 } = opts;

  const bin = sudo ? "/usr/bin/sudo" : dispatcher;
  const cmdArgs = sudo
    ? ["-n", dispatcher, app, cmd, ...args]
    : [app, cmd, ...args];

  debug("execCommand:", bin, cmdArgs.join(" "));

  return new Promise((resolve, reject) => {
    const child = execFile(
      bin,
      cmdArgs,
      {
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, LC_ALL: "en_US.UTF-8" },
      },
      (error, stdout, stderr) => {
        if (error && error.killed) {
          reject(new Error(`Command timed out after ${timeoutMs}ms`));
          return;
        }
        // Spawn errors (ENOENT, EACCES) have string error.code — reject with clear message
        if (error && typeof error.code === "string") {
          reject(new Error(`Spawn failed [${error.code}]: ${error.message}`));
          return;
        }
        resolve({
          exitCode: error ? (error.status ?? error.code ?? 1) : 0,
          stdout: stdout.trimEnd(),
          stderr: stderr.trimEnd(),
        });
      },
    );

    // Guard against hanging child processes
    child.stdin?.end();
  });
}
