# openclaw-safe-exec Product Requirements Document (PRD)

**Version**: 1.0.0
**Date**: 2026-03-08
**Status**: Implemented

---

## 1. Background & Motivation

AI Agents managing macOS infrastructure (service restarts, firewall configuration, display management, etc.) inevitably need `sudo` privileges. However, granting unrestricted root access to an AI Agent is an unacceptable security risk.

**Core tension**: Agents need root access to perform operations tasks, but unlimited root privileges mean a single compromised or misbehaving agent could endanger the entire system.

**Solution**: Add a plugin-level whitelist control layer between the OpenClaw platform and the OS:
- Each agent can only execute explicitly authorized commands
- All operations (including denied ones) are recorded in an audit trail
- Three independent defense layers operate independently — a breach in one does not affect the others

## 2. Target Users

| Role | Need |
|------|------|
| **System administrator** | Safely delegate specific operations privileges to AI Agents without risk of escalation |
| **AI Agent (ops)** | Execute `sudo` commands via structured tool calls without manual interaction |
| **AI Agent (non-ops)** | Execute non-sudo management commands (doc builds, config management, etc.) |
| **Security auditor** | Review all agent operations after the fact, track privilege usage |

## 3. Security Architecture: Three-Layer Defense-in-Depth

```
┌───────────────────────────────────────────────────────┐
│  Layer 3 — OpenClaw Platform (exec-approvals)          │
│  Binary path restrictions: only the dispatcher script  │
├───────────────────────────────────────────────────────┤
│  Layer 2 — Plugin Whitelist (this project)             │
│  Per-agent isolation: each agent can only access its   │
│  own allow list                                        │
├───────────────────────────────────────────────────────┤
│  Layer 1 — OS sudoers (NOPASSWD)                       │
│  Only allows: /path/to/dispatcher.sh <app> <cmd>       │
│  No shell, no arbitrary commands                       │
└───────────────────────────────────────────────────────┘
```

Each layer operates independently — compromising one does not bypass the others.

## 4. Functional Requirements

### FR-1: Per-Agent Isolated Whitelist Permissions

- Each agent has its own `allow` list
- Two matching modes:
  - `app:cmd` — exact match (e.g. `monitoring:status`)
  - `app:*` — wildcard for all commands under an app (e.g. `webserver:*`)
- Unconfigured agents do not receive the `safe_exec` tool (factory returns `null`)
- Tool description dynamically lists the agent's authorized apps

### FR-2: Secure Command Execution

- Uses `child_process.execFile()` (no shell, prevents command injection)
- Determines whether to use `sudo -n` (non-interactive) based on `sudoApps` config
- Execution timeout protection (default 30 seconds)
- stdin closed immediately to prevent child process hangs
- Maximum output buffer 1MB

### FR-3: Audit Logging

- All calls (ALLOW / DENY / RESULT) appended to audit log
- Log format: `ISO8601 | agentId (12-char pad) | verdict | command | extra`
- Audit write failures do not block command execution (non-blocking design)
- Supports `~` path expansion
- Auto-creates log directory

### FR-4: Structured Response

- On success: returns `Command succeeded (exit=0)` followed by stdout
- On failure: returns `Command failed (exit=N)` with stdout and stderr
- Includes `details` object: `{ exitCode, stderr }`
- Returns `(no output)` when there is no stdout

### FR-5: sudoers Installation Tool

- Provides pre-configured sudoers rule template
- Install script validates syntax before writing (`visudo -c`)
- Verifies NOPASSWD is effective after installation
- Sets correct permissions (0440) and ownership (root:wheel)

## 5. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Zero dependencies** | No external npm dependencies, only Node.js built-in modules |
| **ESM** | All ES Modules (`"type": "module"`) |
| **Compatibility** | OpenClaw >= 2026.3.0 |
| **Testability** | Comprehensive test coverage using `node:test` native test runner |
| **Config sanitization** | README and template files contain no machine-specific information |

## 6. Configuration Structure

```jsonc
// ~/.openclaw/openclaw.json
{
  "plugins": {
    "entries": {
      "safe-exec": {
        "enabled": true,
        "config": {
          "dispatcher": "/path/to/dispatcher.sh",    // Required: absolute path to dispatcher
          "sudoApps": ["app1", "app2"],               // Optional: apps requiring sudo
          "auditLog": "~/.openclaw/safe-exec-audit.log",  // Optional: audit log path
          "agents": {                                 // Required: per-agent permission config
            "agent-name": {
              "allow": ["app:cmd", "app:*"]           // Whitelist rules
            }
          }
        }
      }
    }
  }
}
```

## 7. Implementation Status

| Version | Feature | Status |
|---------|---------|--------|
| v1.0.0 | FR-1: Whitelist permission model | Implemented |
| v1.0.0 | FR-2: Secure command execution | Implemented |
| v1.0.0 | FR-3: Audit logging | Implemented |
| v1.0.0 | FR-4: Structured response | Implemented |
| v1.0.0 | FR-5: sudoers installation tool | Implemented |
| v1.0.0 | Config sanitization (template + local separation) | Implemented |
| v1.0.0 | Dynamic tool description | Implemented |

## 8. Future Considerations (Unscheduled)

| Direction | Description |
|-----------|-------------|
| Deny list | Support explicit deny rules with higher priority than allow |
| Rate limiting | Per-agent maximum calls per minute |
| Log rotation | Auto-rotate audit log files by size or date |
| Argument whitelist | Pattern matching validation for `args` parameter |
| Multiple dispatchers | Different apps can point to different dispatcher scripts |

## 9. File Structure

```
openclaw-safe-exec/
├── index.js                          # Plugin entry: register(api)
├── src/
│   ├── safe-exec-tool.js             # Tool factory: per-agent safe_exec creation
│   ├── permission.js                 # Whitelist parsing and matching (pure, no I/O)
│   ├── executor.js                   # execFile wrapper (supports sudo -n)
│   └── audit.js                      # Append-only audit log (non-blocking)
├── tests/
│   ├── permission.test.js            # Permission module unit tests
│   └── safe-exec-tool.test.js        # Tool factory integration tests
├── sudoers/
│   ├── openclaw-agents.sudoers.example  # NOPASSWD rules template
│   └── install-sudoers.sh            # Safe sudoers installer
├── examples/
│   ├── openclaw.json.example         # Sanitized config template
│   └── local.json                    # Local machine config (gitignored)
├── openclaw.plugin.json              # Plugin manifest + config schema
├── package.json                      # Zero dependencies, ESM
├── LICENSE                           # MIT License
├── CLAUDE.md                         # Claude Code development guide
└── docs/
    └── PRD.md                        # This document
```
