#!/usr/bin/env node
/**
 * Postinstall — sets up everything on npm install:
 * 1. Slash commands in ~/.claude/commands/
 * 2. UserPromptSubmit hook for fast command execution
 * 3. Auto-approve permissions for claude-profiles commands
 * 4. Initialize state.json if not present
 *
 * All operations are idempotent and safe to run multiple times.
 * Shell hook for auto-switch on cd is OPTIONAL (run `claude-profiles init`).
 */
import { installSlashCommands } from './core/profile.js';
import { getClaudeDir, getProfilesBaseDir, loadState, saveState } from './core/state.js';
import { installHooks } from './hooks/install.js';
import { existsSync } from 'node:fs';

async function main() {
  const claudeDir = getClaudeDir();
  if (!existsSync(claudeDir)) return;

  // 1. Slash commands
  await installSlashCommands(claudeDir);
  console.log('claude-profiles: /profiles commands installed');

  // 2. UserPromptSubmit hook (fast command execution)
  const hookInstalled = await installHooks(claudeDir);
  if (hookInstalled) {
    console.log('claude-profiles: fast-execution hook installed');
  }

  // 3. Initialize state if not present
  const baseDir = getProfilesBaseDir();
  const state = await loadState(baseDir);
  await saveState(baseDir, state);

  console.log('');
  console.log('claude-profiles: Ready!');
  console.log('claude-profiles: Run: claude-profiles create <name>');
  console.log('claude-profiles: Then: claude-profiles use <name>');
}

main().catch(() => { /* silent fail — non-critical */ });
