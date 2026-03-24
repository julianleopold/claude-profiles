#!/usr/bin/env node
/**
 * Postinstall: adds /profiles slash commands to ~/.claude/commands/
 * so they're available in Claude Code immediately after npm install.
 */
import { installSlashCommands } from './core/profile.js';
import { getClaudeDir } from './core/state.js';
import { existsSync } from 'node:fs';

const claudeDir = getClaudeDir();
if (existsSync(claudeDir)) {
  installSlashCommands(claudeDir)
    .then(() => console.log('claude-profiles: /profiles commands installed'))
    .catch(() => { /* silent fail — non-critical */ });
}
