import { Command } from 'commander';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { getProfilesBaseDir } from '../core/state.js';
import { switchProfile } from '../core/switcher.js';
import { getProfileDir } from '../core/profile.js';
import { detectShell } from './shell-init.js';

const SENTINEL_START = '# >>> claude-profiles >>>';

async function isShellHookInstalled(): Promise<boolean> {
  const shell = detectShell();
  const home = homedir();
  const configFile = shell === 'fish'
    ? join(home, '.config', 'fish', 'config.fish')
    : shell === 'bash'
      ? join(home, '.bashrc')
      : join(home, '.zshrc');

  if (!existsSync(configFile)) return false;
  const content = await readFile(configFile, 'utf-8');
  return content.includes(SENTINEL_START);
}

export async function useAction(name: string, baseDir?: string): Promise<void> {
  await switchProfile(baseDir ?? getProfilesBaseDir(), name);
}

export const useCommand = new Command('use')
  .argument('<name>', 'Profile to switch to')
  .description('Switch the active Claude Code profile')
  .action(async (name: string) => {
    const baseDir = getProfilesBaseDir();
    await useAction(name, baseDir);

    if (name === 'default') {
      console.log('Switched to default profile (~/.claude)');
    } else {
      console.log(`Switched to profile: ${name}`);
      console.log(`CLAUDE_CONFIG_DIR=${getProfileDir(baseDir, name)}`);
    }

    console.log('');

    const hookInstalled = await isShellHookInstalled();
    if (!hookInstalled) {
      console.log('WARNING: Shell hook is not installed!');
      console.log('Without it, Claude Code won\'t pick up the profile switch.');
      console.log('');
      console.log('Run one of:');
      console.log('  claude-profiles init          # guided setup, installs hook');
      console.log('  eval "$(claude-profiles shell-init)"  # add to .zshrc/.bashrc');
      console.log('');
    }

    console.log('>>> RESTART CLAUDE CODE for changes to take effect <<<');
  });
