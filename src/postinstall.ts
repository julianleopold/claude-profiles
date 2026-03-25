#!/usr/bin/env node
/**
 * Postinstall — one command, everything set up:
 * 1. Adds /profiles slash commands to ~/.claude/commands/
 * 2. Installs shell hook into .zshrc/.bashrc/config.fish
 * 3. Installs UserPromptSubmit hook for fast command execution
 *
 * All operations are idempotent and safe to run multiple times.
 */
import { installSlashCommands } from './core/profile.js';
import { getClaudeDir } from './core/state.js';
import { installHooks } from './hooks/install.js';
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
  if (content.includes(SENTINEL_START)) return;

  const hookScript = getShellInitScript(shell);
  await appendFile(configFile, '\n' + hookScript + '\n');
  console.log(`claude-profiles: shell hook added to ${basename(configFile)}`);
}

async function main() {
  const claudeDir = getClaudeDir();
  if (!existsSync(claudeDir)) return;

  // 1. Slash commands
  await installSlashCommands(claudeDir);
  console.log('claude-profiles: /profiles commands installed');

  // 2. Shell hook (auto-switch on cd)
  await installShellHook();

  // 3. UserPromptSubmit hook (fast command execution)
  const hookInstalled = await installHooks(claudeDir);
  if (hookInstalled) {
    console.log('claude-profiles: fast-execution hook installed');
  }

  console.log('');
  console.log('claude-profiles: Ready! Open a new terminal for all changes to take effect.');
  console.log('claude-profiles: Then run: claude-profiles create <name>');
}

main().catch(() => { /* silent fail — non-critical */ });
