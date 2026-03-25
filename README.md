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

Claude Code stores all your settings, hooks, MCP servers, and plugins in one `~/.claude` directory. That's fine until you need different setups — work vs personal, different clients, strict permissions for production repos vs relaxed for side projects. Plugins like [SuperClaude](https://github.com/SuperClaude-Org/SuperClaude_Framework) and [ClaudeKit](https://github.com/carlrannaberg/claudekit) modify the same global config. You shouldn't have to choose.

| Without profiles | With profiles |
|---|---|
| One `~/.claude` config for everything | Multiple configs, switch instantly |
| Same plugins everywhere, even when you don't need them | Toggle plugins per profile |
| Manual backup/restore when switching workflows | `claude-profiles use work` |
| Different MCP servers for different clients? Edit manually | One command to switch |
| No way to auto-switch per project | `.claude-profile` file per repo (like `.nvmrc`) |

## Quick Start

```bash
# Install (that's it — shell hook + slash commands auto-configured)
npm install -g claude-profiles

# Create a work profile
claude-profiles create work

# Switch to it
claude-profiles use work
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
    └── work/                 <-- work profile config (restored to ~/.claude on switch)
        ├── settings.json     <-- different plugins, hooks, permissions
        ├── mcp.json          <-- different MCP servers
        └── CLAUDE.md         <-- different instructions
```

## Statusline

Non-default profiles show their name in the Claude Code statusline:

```
work | Opus 4.6 (1M context) | ctx 9% | $5.2030 | 1h 4m
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

### Inside Claude Code

These slash commands work directly in your Claude Code session:

```
/profiles              # List profiles + show available commands
/profiles-list         # List all profiles (* = active)
/profiles-use <name>   # Switch profile
/profiles-create <name> - <description>  # Create a new profile
/profiles-current      # Show active profile
/profiles-delete <name>  # Delete a profile
/profiles-configure    # Toggle plugins in the active profile
```

No need to leave Claude Code — the built-in hook executes commands instantly and shows the result.

## Example: Work vs Personal

```bash
# Create separate profiles
claude-profiles create work -d "Work — Vercel + Jira MCP servers"
claude-profiles create personal -d "Personal — minimal plugins"

# Configure each profile
claude-profiles use work
# >>> RESTART CLAUDE CODE <<<
# Set up work MCP servers, plugins, permissions...

claude-profiles use personal
# >>> RESTART CLAUDE CODE <<<
# Different plugins, no work MCP servers...

# Switch between them anytime
claude-profiles use work      # back to work setup
claude-profiles use default   # back to your original config
```

Each profile has its own `settings.json`, `mcp.json`, `CLAUDE.md`, `commands/`, and `hooks/`. Switching swaps them all atomically.

## Per-Project Auto-Switching

Add a `.claude-profile` file to any repo:

```bash
echo "work" > .claude-profile
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

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). PRs welcome.

## License

MIT
