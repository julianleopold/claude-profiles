#!/usr/bin/env node
/**
 * Postinstall: adds /profiles slash command to ~/.claude/commands/
 * so it's available in Claude Code immediately after npm install.
 */
import { installSlashCommand } from './core/profile.js';
import { getClaudeDir } from './core/state.js';
import { existsSync } from 'node:fs';

const claudeDir = getClaudeDir();
if (existsSync(claudeDir)) {
  installSlashCommand(claudeDir)
    .then(() => console.log('claude-profiles: /profiles command installed'))
    .catch(() => { /* silent fail — non-critical */ });
}
