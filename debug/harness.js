#!/usr/bin/env node

/**
 * Standalone debug harness for safe-exec plugin.
 *
 * Usage:
 *   node debug/harness.js [agentId] [app] [cmd] [args...]
 *   DEBUG=safe-exec node debug/harness.js alice myapp status
 *   node --inspect-brk debug/harness.js alice myapp status
 *
 * Loads config from examples/local.json by default.
 * Override with CONFIG=path/to/config.json.
 */

import { readFile } from "node:fs/promises";
import { createSafeExecTool } from "../src/safe-exec-tool.js";

const configPath =
  process.env.CONFIG ??
  new URL("../examples/local.json", import.meta.url).pathname;

const agentId = process.argv[2] ?? "alice";
const app = process.argv[3] ?? "myapp";
const cmd = process.argv[4] ?? "status";
const args = process.argv.slice(5);

const raw = await readFile(configPath, "utf-8");
const config = JSON.parse(raw);
const pluginConfig = config.plugins?.entries?.["safe-exec"]?.config ?? config;

const api = { pluginConfig };
const ctx = { agentId };

const tool = createSafeExecTool(api, ctx);
if (!tool) {
  console.error(`Tool not registered for agent "${agentId}"`);
  process.exit(1);
}

console.error(`--- Executing: agent=${agentId} app=${app} cmd=${cmd} args=[${args}] ---`);

try {
  const result = await tool.execute("debug-call", { app, cmd, args });
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error("Error:", err.message);
  process.exit(2);
}
