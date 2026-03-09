# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-08

### Added

- Per-agent whitelisted `sudo` execution via dispatcher script
- Three-layer defense: OS sudoers, plugin whitelist, platform exec-approvals
- Whitelist patterns: `app:cmd` (exact) and `app:*` (wildcard)
- Append-only audit log with ALLOW/DENY/RESULT entries
- `sudo -n` non-interactive mode for configured apps
- `execFile` execution (no shell injection)
- 30-second execution timeout
- Dynamic per-agent tool descriptions
- Unconfigured agents automatically blocked (no tool registered)
- sudoers installer script
- Example configuration templates
- 41 tests with full coverage

[1.0.0]: https://github.com/yangsjt/openclaw-safe-exec/releases/tag/v1.0.0
