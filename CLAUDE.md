# claude-profiles — Development Guide

Profile switcher for Claude Code. TypeScript CLI tool, distributed via npm.

## Architecture

- `src/core/` — core logic (state, profiles, resolver, switcher, toggle)
- `src/commands/` — CLI commands (thin wrappers calling core functions)
- `src/hooks/` — UserPromptSubmit hook for fast slash command execution
- `src/postinstall.ts` — runs on npm install (slash commands, shell hook, settings hook)
- Default profile = `~/.claude` (never modified). Custom profiles in `~/.claude-profiles/profiles/<name>/`.
- Switching sets `CLAUDE_CONFIG_DIR` env var via shell hook.

## Commands

```bash
npm test        # vitest
npm run build   # tsup → dist/
npm run dev     # run CLI from source via tsx
npm run lint    # tsc type check
```

## Key design decisions

- `~/.claude` is the default profile and is never copied or modified
- `CLAUDE_CONFIG_DIR` is the switching mechanism (not symlinks)
- Shell hook reads `state.json` on startup + `.claude-profile` files on cd
- Postinstall handles everything — no separate init step required
- Profile names validated by regex: `^[a-z0-9][a-z0-9_-]{0,62}$`

## Testing

Tests use temp directories (no real `~/.claude` is touched). Run `npm test` before submitting PRs.
