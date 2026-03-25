# Contributing to claude-profiles

Thanks for your interest in contributing!

## Setup

```bash
git clone https://github.com/julianleopold/claude-profiles.git
cd claude-profiles
npm install
npm test        # run tests
npm run dev     # run CLI from source
```

## Development

- `npm test` — run tests (vitest)
- `npm run build` — build for distribution
- `npm run dev -- list` — run CLI commands from source
- `npm run lint` — type check

## Guidelines

- Write tests for new features (TDD preferred)
- Keep it lean — this tool does one thing well
- Follow existing code patterns
- Run `npm test && npm run build` before submitting

## Architecture

- `src/core/` — core logic (state, profiles, resolver, switcher, toggle)
- `src/commands/` — CLI commands (thin wrappers around core)
- `tests/` — vitest tests mirroring src structure
- Default profile (`~/.claude`) is never modified — custom profile configs are saved in `~/.claude-profiles/saved/`
