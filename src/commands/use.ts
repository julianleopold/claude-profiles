import { Command } from 'commander';
import { getProfilesBaseDir } from '../core/state.js';
import { switchProfile } from '../core/switcher.js';

export async function useAction(name: string, baseDir?: string): Promise<void> {
  await switchProfile(baseDir ?? getProfilesBaseDir(), name);
}

export const useCommand = new Command('use')
  .argument('<name>', 'Profile to switch to')
  .description('Switch the active Claude Code profile')
  .action(async (name: string) => {
    const baseDir = getProfilesBaseDir();
    await useAction(name, baseDir);
    console.log(`Switched to profile: ${name}`);
    console.log('Restart Claude Code for changes to take effect.');
  });
