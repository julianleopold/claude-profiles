<p align="center">
  <img src="https://img.shields.io/badge/claude--profiles-Profile%20Switcher%20for%20Claude%20Code-8B5CF6?style=for-the-badge&labelColor=1a1a2e&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM4QjVDRjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTYgMjFWNWEyIDIgMCAwIDAtMi0ySDZhMiAyIDAgMCAwLTIgMnYxNiIvPjxwYXRoIGQ9Ik0yMCAyMVY5YTIgMiAwIDAgMC0yLTJoLTIiLz48cGF0aCBkPSJNOCA4aDF2MiIvPjxwYXRoIGQ9Ik04IDEyaDF2MiIvPjwvc3ZnPg==" alt="claude-profiles" />
</p>

<h1 align="center">claude-profiles</h1>
<p align="center"><strong>Swap Claude Code configurations in one command</strong></p>

<p align="center">
  <a href="https://github.com/julianleopold/claude-profiles/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/julianleopold/claude-profiles/ci.yml?style=flat-square&label=tests" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/claude-profiles"><img src="https://img.shields.io/npm/v/claude-profiles?style=flat-square&color=blue" alt="npm" /></a>
  <a href="https://www.npmjs.com/package/claude-profiles"><img src="https://img.shields.io/npm/dm/claude-profiles?style=flat-square" alt="downloads" /></a>
  <a href="https://github.com/julianleopold/claude-profiles/blob/main/LICENSE"><img src="https://img.shields.io/github/license/julianleopold/claude-profiles?style=flat-square" alt="license" /></a>
  <a href="https://github.com/julianleopold/claude-profiles/stargazers"><img src="https://img.shields.io/github/stars/julianleopold/claude-profiles?style=flat-square" alt="stars" /></a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#commands">Commands</a> &bull;
  <a href="#per-project-auto-switching">Auto-Switching</a> &bull;
  <a href="https://www.npmjs.com/package/claude-profiles">npm</a> &bull;
  <a href="https://github.com/julianleopold/claude-profiles/discussions">Discussions</a>
</p>

---

<p align="center">
  <img src="demo.gif" alt="claude-profiles demo" width="700" />
</p>

**claude-profiles** lets you maintain multiple Claude Code configurations and switch between them instantly. Different plugins, hooks, MCP servers, and settings for different workflows — without conflicts.

```bash
npm install -g claude-profiles
```

One command. Your `~/.claude` becomes the default profile automatically. No setup wizard needed.

## Why?

I built this because I wanted to run [Ruflo](https://github.com/ruvnet/ruflo)'s 60+ agent swarm on one profile while keeping my [superpowers](https://github.com/anthropics/claude-code) + [Vercel](https://vercel.com) setup intact on another. Installing Ruflo overwrites your hooks, MCP servers, and settings — breaking everything else. The same problem exists across the growing Claude Code ecosystem: [SuperClaude](https://github.com/SuperClaude-Org/SuperClaude_Framework), [ClaudeKit](https://github.com/carlrannaberg/claudekit), and others all compete for the same `~/.claude` directory. You shouldn't have to choose.

| Without profiles | With profiles |
|---|---|
| One `~/.claude` config for everything | Multiple configs, switch instantly |
| Installing Ruflo breaks your superpowers setup | Each tool gets its own profile |
| Manual backup/restore when switching workflows | `claude-profiles use ruflo` |
| Same plugins everywhere, even when you don't need them | Toggle plugins per profile |
| No way to auto-switch per project | `.claude-profile` file per repo (like `.nvmrc`) |

## Quick Start

```bash
# Install (that's it — shell hook + slash commands auto-configured)
npm install -g claude-profiles

# Create a profile for Ruflo
claude-profiles create ruflo

# Switch to it
claude-profiles use ruflo
# >>> RESTART CLAUDE CODE <<<

# Switch back to default
claude-profiles use default
```

## How It Works

Your `~/.claude` is the **default** profile — untouched, always there. New profiles are clones stored in `~/.claude-profiles/saved/<name>/`. Switching swaps config files directly inside `~/.claude` — no environment variables, no symlinks.

```
~/.claude/                    <-- always the active config (files get swapped in/out)
~/.claude-profiles/
├── state.json                <-- which profile is active
└── saved/
    ├── default/              <-- default profile backup
    └── ruflo/                <-- ruflo profile config (restored to ~/.claude on switch)
        ├── settings.json     <-- different plugins, hooks, permissions
        ├── mcp.json          <-- different MCP servers
        └── CLAUDE.md         <-- different instructions
```

## Statusline

Non-default profiles show their name in the Claude Code statusline:

```
ruflo | Opus 4.6 (1M context) | ctx 9% | $5.2030 | 1h 4m
```

## Commands

```bash
claude-profiles create <name>                # Create profile (clones ~/.claude)
claude-profiles use <name>                   # Switch profile
claude-profiles list                         # List all profiles (* = active)
claude-profiles current                      # Show active profile
claude-profiles delete <name>                # Delete a profile
claude-profiles toggle plugin <name> on|off  # Toggle plugin per profile
claude-profiles init                         # Guided setup (optional)
claude-profiles uninstall                    # Clean removal
```

Also available as `/profiles`, `/profiles-list`, `/profiles-use`, `/profiles-create`, `/profiles-configure` inside Claude Code.

## Example: Setting Up Ruflo

[Ruflo](https://github.com/ruvnet/ruflo) is an agent orchestration platform for Claude Code. Its `init` overwrites `CLAUDE.md` and adds hooks to `settings.json` — which conflicts with other setups. Here's how to run it alongside your existing config:

```bash
# 1. Create a dedicated profile for Ruflo
claude-profiles create ruflo

# 2. Switch to it (your current config is saved, ~/.claude now has a copy)
claude-profiles use ruflo
# >>> RESTART CLAUDE CODE <<<

# 3. Install Ruflo into this isolated profile
npx ruflo@latest init --wizard

# 4. Restart Claude Code — Ruflo is now active with all its agents and hooks

# 5. When you're done, switch back
claude-profiles use default
# >>> RESTART CLAUDE CODE <<< — you're back to your original setup, untouched
```

This works because `claude-profiles use ruflo` swaps your config files before Ruflo's init runs. Ruflo writes to `~/.claude` thinking it's a fresh setup, but it's actually the ruflo profile's config. Your default config is safely saved in `~/.claude-profiles/saved/default/` and restored when you switch back.

> **Note:** Ruflo's `init` overwrites `CLAUDE.md` and adds hooks that may reference invalid event names ([ruvnet/ruflo#1150](https://github.com/ruvnet/ruflo/issues/1150)). Using a separate profile keeps these changes isolated.

## Per-Project Auto-Switching

Add a `.claude-profile` file to any repo:

```bash
echo "ruflo" > .claude-profile
```

When you `cd` into that directory, the shell hook automatically switches. Leave — reverts to default.

Like `.nvmrc` for Node.js versions, but for Claude Code configurations.

### Resolution Chain

1. `CLAUDE_PROFILES_ACTIVE` env var (highest priority)
2. `.claude-profile` file (walks up directory tree)
3. Active profile from `state.json`
4. Fallback: `default` (`~/.claude`)

## Install / Uninstall

```bash
# Install — one command, everything configured
npm install -g claude-profiles

# Uninstall — asks which profile to keep, cleans everything
claude-profiles uninstall
npm uninstall -g claude-profiles
```

The install automatically:
- Adds `/profiles-*` slash commands to Claude Code
- Installs a shell hook in `.zshrc`/`.bashrc`/`config.fish` (auto-switch on `cd`)
- Registers a fast-execution hook (so `/profiles-list` responds in ~1s)
- Adds auto-approve permissions for `claude-profiles` commands

The uninstall removes all of the above. `~/.claude` is never modified.

<details>
<summary><strong>What profiles isolate</strong></summary>

Each profile has its own:
- `settings.json` — plugins, hooks, permissions, model preferences
- `mcp.json` — MCP server configurations
- `CLAUDE.md` — custom instructions
- `commands/` — slash commands
- `settings.local.json` — local overrides

Shared across all profiles:
- Plugin cache (downloaded files)
- Project/session data
- Auth credentials
- Auto-memory (per-project in `~/.claude/projects/`, not per-profile)

</details>

<details>
<summary><strong>Shell integration details</strong></summary>

The shell hook is added automatically on install using conda-style sentinel comments:

```bash
# >>> claude-profiles >>>
# !! Contents within this block are managed by claude-profiles !!
_claude_profiles_hook() { ... }
# <<< claude-profiles <<<
```

Supports **zsh**, **bash**, and **fish**. Auto-detects your shell. Cleanly removed on uninstall.

To add manually instead: `eval "$(claude-profiles shell-init)"`

</details>

<details>
<summary><strong>Design influences</strong></summary>

- **[pyenv](https://github.com/pyenv/pyenv)** — resolution chain (env var > file > default)
- **[direnv](https://github.com/direnv/direnv)** — auto-switch on `cd`
- **[nvm](https://github.com/nvm-sh/nvm)** — `.nvmrc` convention
- **[conda](https://docs.conda.io/)** — sentinel comments for shell config
- **[Codex CLI](https://github.com/openai/codex)** — profile overrides

</details>

## Related

- [GitHub Issue #7075](https://github.com/anthropics/claude-code/issues/7075) — Feature request for native Claude Code profiles
- [Codex CLI Profiles](https://github.com/openai/codex/blob/main/docs/config.md#profiles-and-overrides) — OpenAI's approach
- [Ruflo](https://github.com/ruvnet/ruflo) — AI agent orchestration (great use case for profiles)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). PRs welcome.

## License

MIT
