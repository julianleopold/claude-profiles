import { Command } from 'commander';
import { getProfilesBaseDir } from '../core/state.js';
import { switchProfile } from '../core/switcher.js';
import { getProfileDir } from '../core/profile.js';

export async function useAction(name: string, baseDir?: string): Promise<void> {
  await switchProfile(baseDir ?? getProfilesBaseDir(), name);
}

export const useCommand = new Command('use')
  .argument('<name>', 'Profile to switch to')
  .description('Switch the active Claude Code profile')
  .action(async (name: string) => {
    const baseDir = getProfilesBaseDir();
    await useAction(name, baseDir);
    const profileDir = getProfileDir(baseDir, name);
    console.log(`Switched to profile: ${name}`);
    console.log(`CLAUDE_CONFIG_DIR=${profileDir}`);
    console.log('');
    console.log('>>> RESTART CLAUDE CODE for changes to take effect <<<');
    console.log('(The shell hook will pick this up in new terminals automatically)');
  });
