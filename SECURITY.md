# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | Yes       |

## Reporting a Vulnerability

This plugin deals with privileged (`sudo`) command execution, so security issues are taken seriously.

**Do not open a public issue for security vulnerabilities.**

Instead, please report them privately:

1. Email **yangsjt** via their [GitHub profile](https://github.com/yangsjt)
2. Or use [GitHub Security Advisories](https://github.com/yangsjt/openclaw-safe-exec/security/advisories/new) to report privately

Include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You should receive an acknowledgment within 48 hours. A fix will be prioritized and released as a patch version.

## Scope

The following are in scope:

- Whitelist bypass (executing commands not in the allow list)
- Audit log tampering or bypass
- Command injection through app/cmd parameters
- Privilege escalation beyond configured permissions
- sudoers rule misconfiguration in provided templates
