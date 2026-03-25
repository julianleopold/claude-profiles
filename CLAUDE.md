# claude-profiles — Development Guide

Profile switcher for Claude Code. TypeScript CLI tool, distributed via npm.

## Architecture

- `src/core/` — core logic (state, profiles, resolver, switcher, toggle)
- `src/commands/` — CLI commands (thin wrappers calling core functions)
- `src/hooks/` — UserPromptSubmit hook for fast slash command execution
- `src/postinstall.ts` — runs on npm install (slash commands, hooks, permissions)
- Switching swaps config files inside `~/.claude/` directly (no CLAUDE_CONFIG_DIR)
- Saved profiles stored in `~/.claude-profiles/saved/<name>/`

## Commands

```bash
npm test        # vitest
npm run build   # tsup → dist/
npm run dev     # run CLI from source via tsx
npm run lint    # tsc type check
```

## Key design decisions

- File-swap approach: swap settings.json, mcp.json, CLAUDE.md, commands/, hooks/ inside ~/.claude
- Auth, plugins, sessions, history stay untouched (never swapped)
- Crash recovery via intent file (.switch-intent) + lockfile (.switch-lock)
- Directory swaps use temp-then-rename for atomicity
- Profile names validated by regex: `^[a-z0-9][a-z0-9_-]{0,62}$`
- Tests use `CLAUDE_PROFILES_CLAUDE_DIR` env var to avoid touching real ~/.claude

## Testing

Tests use temp directories via `CLAUDE_PROFILES_CLAUDE_DIR` env var override. No real `~/.claude` is touched. Run `npm test` before submitting PRs.
