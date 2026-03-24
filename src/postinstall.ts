#!/usr/bin/env node
/**
 * Postinstall:
 * 1. Adds /profiles slash commands to ~/.claude/commands/
 * 2. Installs shell hook into .zshrc/.bashrc/config.fish (with sentinel comments)
 *
 * Both are idempotent — safe to run multiple times.
 */
import { installSlashCommands } from './core/profile.js';
import { getClaudeDir } from './core/state.js';
import { getShellInitScript, detectShell } from './commands/shell-init.js';
import { existsSync } from 'node:fs';
import { readFile, appendFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';

const SENTINEL_START = '# >>> claude-profiles >>>';

async function installShellHook(): Promise<void> {
  const shell = detectShell();
  const home = homedir();
  const configFile = shell === 'fish'
    ? join(home, '.config', 'fish', 'config.fish')
    : shell === 'bash'
      ? join(home, '.bashrc')
      : join(home, '.zshrc');

  if (!existsSync(configFile)) return;

  const content = await readFile(configFile, 'utf-8');
  if (content.includes(SENTINEL_START)) return; // already installed

  const hookScript = getShellInitScript(shell);
  await appendFile(configFile, '\n' + hookScript + '\n');
  console.log(`claude-profiles: shell hook added to ${basename(configFile)}`);
}

async function main() {
  const claudeDir = getClaudeDir();

  // Install slash commands
  if (existsSync(claudeDir)) {
    await installSlashCommands(claudeDir);
    console.log('claude-profiles: /profiles commands installed');
  }

  // Install shell hook
  await installShellHook();
}

main().catch(() => { /* silent fail — non-critical */ });
