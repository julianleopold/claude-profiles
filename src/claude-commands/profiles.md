# /profiles — Manage Claude Code Profiles

Run profile management from within Claude Code by executing the corresponding CLI command.

## Commands

| Action | Command |
|--------|---------|
| List all profiles | `claude-profiles list` |
| Switch profile | `claude-profiles use <name>` |
| Show active profile | `claude-profiles current` |
| Create a profile | `claude-profiles create <name>` |
| Delete a profile | `claude-profiles delete <name>` |
| Toggle a plugin | `claude-profiles toggle plugin <name> on\|off` |

## Notes

- After switching profiles, **restart Claude Code** for changes to take effect
- The active profile shows in the statusline: `default | Opus 4.6 (1M context) | ...`
- Use `.claude-profile` files in project roots for automatic per-directory switching
- To edit a profile's config directly: open `~/.claude-profiles/profiles/<name>/settings.json`
- To edit MCP servers: open `~/.claude-profiles/profiles/<name>/mcp.json`
