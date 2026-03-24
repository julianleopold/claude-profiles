# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public issue
2. Email the maintainer directly or use GitHub's [private vulnerability reporting](https://github.com/julianleopold/claude-profiles/security/advisories/new)

## Scope

claude-profiles manages Claude Code configuration files. Security-relevant areas include:
- Profile name validation (path traversal prevention)
- Shell hook injection (sentinel-bounded, no user input in shell commands)
- File operations (copying config directories)

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |
