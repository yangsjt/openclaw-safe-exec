import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { debug } from "./debug.js";

/**
 * Append an audit entry to the log file.
 *
 * Format: ISO8601 | agentId | verdict | detail | extra
 *
 * @param {string} logPath  - Absolute path to audit log
 * @param {string} agentId
 * @param {"ALLOW"|"DENY"|"RESULT"} verdict
 * @param {string} detail   - e.g. "nomachine status"
 * @param {string} [extra]  - e.g. "exit=0"
 */
export async function audit(logPath, agentId, verdict, detail, extra = "") {
  if (!logPath) return;

  const ts = new Date().toISOString();
  const padId = agentId.padEnd(12);
  const line = `${ts} | ${padId} | ${verdict.padEnd(5)} | ${detail}${extra ? ` | ${extra}` : ""}\n`;

  try {
    await mkdir(dirname(logPath), { recursive: true });
    await appendFile(logPath, line, "utf-8");
  } catch (err) {
    debug("audit: write failed:", err.message);
  }
}
