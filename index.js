import { createSafeExecTool } from "./src/safe-exec-tool.js";

/**
 * OpenClaw plugin entry point.
 *
 * Registers a `safe_exec` tool that is scoped per-agent:
 * each agent only sees commands allowed in the plugin config.
 */
export default function register(api) {
  api.registerTool((ctx) => createSafeExecTool(api, ctx));
}
