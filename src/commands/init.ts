import { Command } from 'commander';
import * as p from '@clack/prompts';
import { homedir } from 'node:os';
import { join, basename } from 'node:path';
import { existsSync } from 'node:fs';
import { readFile, appendFile } from 'node:fs/promises';
import { getProfilesBaseDir, saveState } from '../core/state.js';
import { createProfile } from '../core/profile.js';
import { createBackup } from '../core/backup.js';
import { setupSharedResources } from '../core/sharing.js';
import { switchProfile } from '../core/switcher.js';
import { getShellInitScript, detectShell } from './shell-init.js';
import type { State, SharedResource } from '../types.js';

const SENTINEL_START = '# >>> claude-profiles >>>';

function getShellConfigPath(): string {
  const shell = detectShell();
  const home = homedir();
  if (shell === 'fish') return join(home, '.config', 'fish', 'config.fish');
  if (shell === 'bash') return join(home, '.bashrc');
  return join(home, '.zshrc');
}

export const initCommand = new Command('init')
  .description('Set up claude-profiles for the first time')
  .action(async () => {
    p.intro('claude-profiles setup');

    const baseDir = getProfilesBaseDir();
    const claudeDir = join(homedir(), '.claude');

    if (!existsSync(claudeDir)) {
      p.log.error('No ~/.claude directory found. Install Claude Code first.');
      process.exit(1);
    }

    p.log.step('Backing up current ~/.claude config...');
    await createBackup(baseDir, claudeDir);
    p.log.success('Backup created');

    const sharedResources: SharedResource[] = ['plugins', 'projects'];
    p.log.step('Creating "default" profile from current config...');
    await createProfile(baseDir, 'default', {
      description: 'Default profile (from existing config)',
      fromDir: claudeDir,
    });
    await setupSharedResources(baseDir, join(baseDir, 'profiles', 'default'), claudeDir, sharedResources);

    const state: State = {
      defaultProfile: 'default', activeProfile: 'default',
      sharedResources, version: '0.1.0',
    };
    await saveState(baseDir, state);
    p.log.success('Default profile created and activated');

    const createMore = await p.confirm({ message: 'Create additional profiles now?' });
    if (createMore && !p.isCancel(createMore)) {
      let more = true;
      while (more) {
        const name = await p.text({ message: 'Profile name:', placeholder: 'e.g., ruflo, work' });
        if (p.isCancel(name)) break;
        const desc = await p.text({ message: 'Description (optional):' });
        await createProfile(baseDir, name as string, { description: (desc as string) || undefined });
        await setupSharedResources(baseDir, join(baseDir, 'profiles', name as string), claudeDir, sharedResources);
        p.log.success(`Profile "${name}" created`);
        const again = await p.confirm({ message: 'Create another?' });
        more = !p.isCancel(again) && !!again;
      }
    }

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
      `claude-profiles use <name>         Switch profile\nclaude-profiles list               See all profiles\necho "ruflo" > .claude-profile     Auto-switch per project`,
      'Quick reference',
    );
    p.outro('Setup complete!');
  });
