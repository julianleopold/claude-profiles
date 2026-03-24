import { Command } from 'commander';
import * as p from '@clack/prompts';
import { homedir } from 'node:os';
import { join, basename } from 'node:path';
import { existsSync } from 'node:fs';
import { readFile, appendFile } from 'node:fs/promises';
import { getProfilesBaseDir, saveState } from '../core/state.js';
import { createProfile } from '../core/profile.js';
import { getShellInitScript, detectShell } from './shell-init.js';
import type { State } from '../types.js';

const SENTINEL_START = '# >>> claude-profiles >>>';

function getShellConfigPath(): string {
  const shell = detectShell();
  const home = homedir();
  if (shell === 'fish') return join(home, '.config', 'fish', 'config.fish');
  if (shell === 'bash') return join(home, '.bashrc');
  return join(home, '.zshrc');
}

export const initCommand = new Command('init')
  .description('Set up claude-profiles (optional — your ~/.claude is already the default profile)')
  .action(async () => {
    p.intro('claude-profiles setup');

    const baseDir = getProfilesBaseDir();
    const claudeDir = join(homedir(), '.claude');

    if (!existsSync(claudeDir)) {
      p.log.error('No ~/.claude directory found. Install Claude Code first.');
      process.exit(1);
    }

    // Initialize state if needed
    p.log.info('Your ~/.claude is already the "default" profile — nothing to migrate.');

    const state: State = {
      profiles: {},
      activeProfile: null,
      version: '0.1.0',
    };
    await saveState(baseDir, state);

    // Offer to create additional profiles
    const createMore = await p.confirm({ message: 'Create additional profiles now?' });
    if (createMore && !p.isCancel(createMore)) {
      let more = true;
      while (more) {
        const name = await p.text({ message: 'Profile name:', placeholder: 'e.g., ruflo, work' });
        if (p.isCancel(name)) break;
        const desc = await p.text({ message: 'Description (optional):' });
        await createProfile(baseDir, name as string, { description: (desc as string) || undefined });
        p.log.success(`Profile "${name}" created (cloned from ~/.claude)`);
        const again = await p.confirm({ message: 'Create another?' });
        more = !p.isCancel(again) && !!again;
      }
    }

    // Shell hook
    const shellConfig = getShellConfigPath();
    let hookAlreadyInstalled = false;
    if (existsSync(shellConfig)) {
      const content = await readFile(shellConfig, 'utf-8');
      hookAlreadyInstalled = content.includes(SENTINEL_START);
    }

    if (!hookAlreadyInstalled) {
      const addHook = await p.confirm({
        message: `Add shell hook to ${basename(shellConfig)}? (enables auto-switching per project)`,
      });
      if (addHook && !p.isCancel(addHook)) {
        const shell = detectShell();
        const hookScript = getShellInitScript(shell);
        await appendFile(shellConfig, '\n' + hookScript + '\n');
        p.log.success(`Shell hook added to ${basename(shellConfig)}`);
      } else {
        p.note(`Add manually later:\n  eval "$(claude-profiles shell-init)"`, 'Shell hook');
      }
    } else {
      p.log.info('Shell hook already installed');
    }

    p.note(
      `claude-profiles create <name>      Create a new profile\nclaude-profiles use <name>         Switch profile\nclaude-profiles list               See all profiles\necho "ruflo" > .claude-profile     Auto-switch per project`,
      'Quick reference',
    );
    p.outro('Setup complete!');
  });
