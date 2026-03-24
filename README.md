<p align="center">
  <h1 align="center">claude-profiles</h1>
  <p align="center">Swap Claude Code configurations in one command</p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/claude-profiles"><img src="https://img.shields.io/npm/v/claude-profiles?style=for-the-badge&color=blue" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/claude-profiles"><img src="https://img.shields.io/npm/dm/claude-profiles?style=for-the-badge" alt="npm downloads" /></a>
  <a href="https://github.com/julianleopold/claude-profiles/blob/main/LICENSE"><img src="https://img.shields.io/github/license/julianleopold/claude-profiles?style=for-the-badge" alt="license" /></a>
  <a href="https://github.com/julianleopold/claude-profiles/stargazers"><img src="https://img.shields.io/github/stars/julianleopold/claude-profiles?style=for-the-badge" alt="stars" /></a>
</p>

---

**claude-profiles** lets you maintain multiple Claude Code configurations and switch between them instantly. Different plugins, hooks, MCP servers, and settings for different workflows — without conflicts.

## Why?

The Claude Code ecosystem has grown fast. Tools like [Ruflo](https://github.com/ruvnet/ruflo), [SuperClaude](https://github.com/SuperClaude-Org/SuperClaude_Framework), and [superpowers](https://github.com/anthropics/claude-code) all install hooks, MCP servers, and settings that **conflict with each other**. You shouldn't have to choose.

| Without profiles | With profiles |
|---|---|
| One `~/.claude` config for everything | Multiple configs, switch instantly |
| Installing Ruflo breaks your superpowers setup | Each tool gets its own profile |
| Manual backup/restore when switching workflows | `claude-profiles use ruflo` |
| Same plugins everywhere, even when you don't need them | Toggle plugins per profile |
| No way to auto-switch per project | `.claude-profile` file per repo (like `.nvmrc`) |

## Quick Start

```bash
npm install -g claude-profiles
claude-profiles init
```

That's it. Your current `~/.claude` is backed up and becomes the `default` profile. The init wizard offers to:
- Create additional profiles
- Add the shell hook to your `.zshrc`/`.bashrc`/`config.fish`

## How It Works

```
~/.claude-profiles/
├── state.json              # Active profile, defaults
├── .pre-profiles-backup/   # Your original ~/.claude (safe)
├── profiles/
│   ├── default/            # Your current setup
│   │   ├── settings.json   # Plugins, hooks, permissions
│   │   ├── mcp.json        # MCP servers
│   │   └── CLAUDE.md       # Instructions
│   └── ruflo/              # Ruflo setup
│       ├── settings.json   # Different plugins, hooks
│       ├── mcp.json        # Different MCP servers
│       └── CLAUDE.md       # Different instructions
└── shared/
    ├── plugins/            # Plugin cache (shared, not duplicated)
    └── projects/           # Session data (shared)
```

Switching sets `CLAUDE_CONFIG_DIR` to the active profile's directory. Claude Code reads from there instead of `~/.claude`.

## Statusline

The active profile shows in your Claude Code statusline:

```
default | Opus 4.6 (1M context) | ctx 9% | $5.2030 | 1h 4m
ruflo   | Opus 4.6 (1M context) | ctx 9% | $5.2030 | 1h 4m
```

## Commands

```bash
claude-profiles init                         # First-time setup
claude-profiles create <name>                # Create a new profile
claude-profiles create ruflo --from ~/.claude # Clone from existing config
claude-profiles use <name>                   # Switch profile
claude-profiles list                         # List all profiles (* = active)
claude-profiles current                      # Show active profile
claude-profiles delete <name>                # Delete a profile
claude-profiles toggle plugin <name> on|off  # Toggle plugin per profile
claude-profiles shell-init                   # Output shell hook
claude-profiles uninstall                    # Clean removal
```

Also available as `/profiles` inside Claude Code.

## Per-Project Auto-Switching

Add a `.claude-profile` file to any repo:

```bash
echo "ruflo" > /path/to/my-project/.claude-profile
```

When you `cd` into that directory, the shell hook automatically switches to the `ruflo` profile. Leave the directory — switches back to default.

Like `.nvmrc` for Node.js versions, but for Claude Code configurations.

### Resolution Chain

Profile is resolved in this order (highest priority first):

1. `CLAUDE_PROFILES_ACTIVE` environment variable
2. `.claude-profile` file (walks up directory tree)
3. Default profile from `state.json`
4. Fallback: `"default"`

## Shell Integration

The shell hook enables auto-switching. Add it during `init`, or manually:

```bash
# Added automatically by `claude-profiles init`
# Or add manually to .zshrc / .bashrc:
eval "$(claude-profiles shell-init)"
```

Supports **zsh**, **bash**, and **fish**. Auto-detects your shell.

Uses [conda-style sentinel comments](https://docs.conda.io/projects/conda/en/latest/user-guide/install/index.html) for clean install/uninstall:
```bash
# >>> claude-profiles >>>
# !! Contents within this block are managed by claude-profiles !!
...
# <<< claude-profiles <<<
```

## Uninstall

```bash
claude-profiles uninstall
```

Asks which profile to keep, restores it as `~/.claude`, removes the shell hook from your config files, and cleans up `~/.claude-profiles`. Then:

```bash
npm uninstall -g claude-profiles
```

Zero orphaned state.

## Design

Inspired by:
- **[pyenv](https://github.com/pyenv/pyenv)** — resolution chain (env var > file > default)
- **[direnv](https://github.com/direnv/direnv)** — auto-switch on `cd`
- **[nvm](https://github.com/nvm-sh/nvm)** — `.nvmrc` convention
- **[conda](https://docs.conda.io/)** — sentinel comments for shell config
- **[Codex CLI](https://github.com/openai/codex)** — profile overrides

<details>
<summary>Shared resources</summary>

Plugin cache and project/session data are symlinked from a shared directory — not duplicated per profile. This means:
- Installing a plugin in one profile makes it available (but not enabled) in all profiles
- `enabledPlugins` in each profile's `settings.json` controls what's active
- Conversation history is shared across profiles

</details>

<details>
<summary>What profiles isolate</summary>

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
- Auto-memory (e.g., Ruflo's learned patterns) — stored per-project in `~/.claude/projects/`, not per-profile. This is intentional: memories are about the project, not the profile.

</details>

## Related

- [GitHub Issue #7075](https://github.com/anthropics/claude-code/issues/7075) — Feature request for native Claude Code profiles
- [Codex CLI Profiles](https://github.com/openai/codex/blob/main/docs/config.md#profiles-and-overrides) — OpenAI's approach

## License

MIT
