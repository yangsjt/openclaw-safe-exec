# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

OpenClaw plugin that provides per-agent, whitelist-gated `sudo` execution through a dispatcher script. Three-layer defense: OS sudoers → plugin whitelist → platform exec-approvals.

## Commands

```bash
npm test                              # Run all tests (node:test)
node --test tests/permission.test.js  # Run single test file
```

## Architecture

```
index.js                    → register(api) entry point, calls createSafeExecTool per agent
src/safe-exec-tool.js       → Tool factory: creates agent-scoped safe_exec tool
  ├─ src/permission.js      → isAllowed(allowList, app, cmd) — pure, no I/O
  ├─ src/executor.js        → execCommand() — child_process.execFile with optional sudo -n
  └─ src/audit.js           → audit() — append-only log, non-blocking on failure
```

**Execution flow:** whitelist check → audit ALLOW/DENY → execFile dispatcher → audit RESULT

## Permission Model

- Patterns: `app:cmd` (exact) or `app:*` (wildcard)
- Agents not in config get no tool (returns `null`)
- `sudoApps` array determines which apps run with `sudo -n`
- Tool description dynamically lists only the agent's authorized apps

## Config

Plugin config lives in `~/.openclaw/openclaw.json` under `plugins.entries.safe-exec.config`:
- `dispatcher` — absolute path to dispatcher script
- `sudoApps` — apps requiring sudo
- `auditLog` — path (supports `~` expansion)
- `agents.<id>.allow` — whitelist array per agent

Template: `examples/openclaw.json.example` | Local: `examples/local.json`

## Conventions

- ESM (`"type": "module"` in package.json)
- Node.js native test runner (`node:test`, `node:assert/strict`)
- No external dependencies (zero `dependencies` in package.json)
- Audit log format: `ISO8601 | agentId (12-char pad) | ALLOW/DENY/RESULT | app cmd | exit=N`
