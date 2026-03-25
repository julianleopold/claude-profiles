# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed
- Atomic lockfile acquisition prevents race conditions on concurrent switches
- Stale lock auto-recovery (detects dead PID or locks older than 60s)
- Config files from previous profile are cleaned up during switch (prevents leakage between profiles)
- Hook handler validates profile names before executing shell commands
- Toggle command rejects invalid state values (must be "on" or "off")
- Switching to the already-active profile shows "already active" instead of doing a full swap

### Changed
- README documents correct file-swap architecture (was incorrectly describing `CLAUDE_CONFIG_DIR`)
- SECURITY.md lists 0.2.x as supported
- Added Ruflo setup guide to README with step-by-step workflow

## [0.2.3] - 2025-03-24

### Fixed
- CI: pin `@types/node` to `^20`, add types to tsconfig for Node 20/22/24 compat

## [0.2.2] - 2025-03-24

### Fixed
- More precise restart message after profile switch

## [0.2.1] - 2025-03-24

### Fixed
- Safety backup on first profile creation (never deleted, even on uninstall)
- Uninstall asks to keep saved profiles

## [0.2.0] - 2025-03-24

### Changed
- **Breaking:** File-swap profile switching replaces `CLAUDE_CONFIG_DIR` approach
- Crash-safe switching with lockfile, intent recovery, and atomic directory swap

## [0.1.1] - 2025-03-23

### Fixed
- Use `printf` instead of `echo -n` for statusline (portability)
- Clearer messages about when to open new terminal vs restart Claude Code

## [0.1.0] - 2025-03-23

### Added
- Profile CRUD: create, list, use, current, delete
- Plugin toggle per profile
- Pyenv-style resolution chain (env var > `.claude-profile` file > state > default)
- Direnv-style shell hook with auto-detect and sentinel comments (zsh, bash, fish)
- UserPromptSubmit hook for near-instant `/profiles` commands
- Postinstall auto-setup (slash commands, hooks, permissions)
- Statusline shows active profile name
- Safety backup of original `~/.claude` config
- Per-project auto-switching via `.claude-profile` files
- Uninstall command with clean removal
- End-to-end test coverage

[Unreleased]: https://github.com/julianleopold/claude-profiles/compare/v0.2.3...HEAD
[0.2.3]: https://github.com/julianleopold/claude-profiles/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/julianleopold/claude-profiles/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/julianleopold/claude-profiles/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/julianleopold/claude-profiles/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/julianleopold/claude-profiles/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/julianleopold/claude-profiles/releases/tag/v0.1.0
