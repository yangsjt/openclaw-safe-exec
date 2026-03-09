# openclaw-safe-exec

**Why?** — AI Agents that manage macOS infrastructure need `sudo` for tasks like restarting services or applying configuration changes. Unrestricted root access is unacceptable. This plugin gives each agent exactly the privileges it needs — no more, no less — with every action recorded in an audit trail.

## Three-Layer Defense-in-Depth

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 3 — OpenClaw Platform (exec-approvals)               │
│  Binary path restrictions: only tools.sh can be executed    │
├─────────────────────────────────────────────────────────────┤
│  Layer 2 — Plugin Whitelist (this plugin)                   │
│  Per-agent allow list: david → webserver:*, database:*      │
│                        bob   → backup:*, monitoring:*       │
├─────────────────────────────────────────────────────────────┤
│  Layer 1 — OS sudoers (NOPASSWD)                            │
│  Only allows: /path/to/tools.sh <app> <cmd>                 │
│  No shell, no arbitrary commands                            │
└─────────────────────────────────────────────────────────────┘
```

Each layer is independent — compromising one does not bypass the others.

## Per-Agent Permission Isolation

| Agent | Role | Allowed | Denied |
|-------|------|---------|--------|
| **david** | Infrastructure ops | `webserver:*`, `database:*`, `monitoring:status`, `backup:status`, `backup:list` | `backup:start/stop/restart`, `monitoring:*` |
| **bob** | Maintenance assistant | `backup:*`, `monitoring:*` | `webserver:*`, `database:*` |

david can restart the webserver and manage the database, but cannot run backups or view full monitoring. bob can manage backups and monitoring, but has zero access to core services. Each agent operates in its own permission sandbox.

## Audit Trail

Every call — allowed or denied — is appended to the audit log:

```
2026-03-08T16:30:00.000Z | david        | ALLOW  | webserver status
2026-03-08T16:30:01.000Z | david        | RESULT | webserver status | exit=0
2026-03-08T16:31:00.000Z | bob          | DENY   | database status
```

Fields: timestamp, agent ID, verdict (ALLOW/DENY/RESULT), command, exit code. Enables post-incident forensics and compliance review.

## Installation

1. **Clone and install the plugin**

   ```bash
   cd ~/projects/openclaw-safe-exec
   openclaw plugins install .
   ```

2. **Install sudoers rules** (grants NOPASSWD for `tools.sh` only)

   ```bash
   bash sudoers/install-sudoers.sh
   ```

3. **Add plugin config to `~/.openclaw/openclaw.json`**

   Copy [`examples/openclaw.json.example`](examples/openclaw.json.example) and customize:

   - `dispatcher` — absolute path to your dispatcher script
   - `sudoApps` — apps that require `sudo` to execute
   - `agents` — per-agent allow lists (see Whitelist Format below)

4. **Restart OpenClaw gateway**

## Whitelist Format

- `app:cmd` — exact match (e.g. `monitoring:status`)
- `app:*` — all commands for that app (e.g. `webserver:*`)

## Tests

```bash
npm test
```

## Files

| File | Purpose |
|------|---------|
| `index.js` | Plugin entry: `register(api)` |
| `src/safe-exec-tool.js` | Tool factory with per-agent permission |
| `src/permission.js` | Whitelist parsing and matching |
| `src/executor.js` | `child_process.execFile` wrapper with sudo |
| `src/audit.js` | Append-only audit log |
| `sudoers/openclaw-agents.sudoers.example` | NOPASSWD rules template |
| `sudoers/install-sudoers.sh` | Safe sudoers installer |
| `examples/openclaw.json.example` | Sanitized config template |
| `examples/local.json` | Local machine config (gitignored) |
| `openclaw.plugin.json` | Plugin manifest (id: `safe-exec`) |
