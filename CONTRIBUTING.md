# Contributing to openclaw-safe-exec

Thanks for your interest in contributing! This document covers everything you need to get started.

## Development Setup

```bash
git clone https://github.com/yangsjt/openclaw-safe-exec.git
cd openclaw-safe-exec
```

No `npm install` needed — zero dependencies.

## Running Tests

```bash
npm test                              # Run all tests
node --test tests/permission.test.js  # Run a single test file
```

All tests use the Node.js native test runner (`node:test`) and `node:assert/strict`. No test framework to install.

## Project Structure

```
index.js                    → Plugin entry point
src/safe-exec-tool.js       → Tool factory (per-agent)
src/permission.js           → Whitelist matching (pure, no I/O)
src/executor.js             → child_process.execFile wrapper
src/audit.js                → Append-only audit log
tests/                      → All test files
```

## Making Changes

1. Fork the repo and create a branch from `main`
2. Write tests first — the project follows TDD
3. Run `npm test` and ensure all tests pass
4. Keep zero external dependencies
5. Follow existing code style (ESM, no semicolons in tests)

## Pull Request Process

1. Update tests for any new or changed functionality
2. Ensure `npm test` passes with no failures
3. Update `CHANGELOG.md` under an `[Unreleased]` section
4. Submit a PR against `main`
5. A maintainer will review and merge

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add timeout configuration option
fix: handle missing dispatcher path gracefully
docs: update configuration example
test: add edge case for wildcard matching
```

## Reporting Bugs

Open an issue at https://github.com/yangsjt/openclaw-safe-exec/issues with:

- Node.js version
- OS and version
- Steps to reproduce
- Expected vs actual behavior

## Security Issues

Please report security vulnerabilities privately — see [SECURITY.md](SECURITY.md).
