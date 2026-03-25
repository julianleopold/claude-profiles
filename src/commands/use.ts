import { Command } from 'commander';
import { getProfilesBaseDir } from '../core/state.js';
import { switchProfile } from '../core/switcher.js';

export async function useAction(name: string, baseDir?: string): Promise<boolean> {
  return switchProfile(baseDir ?? getProfilesBaseDir(), name);
}

export const useCommand = new Command('use')
  .argument('<name>', 'Profile to switch to')
  .description('Switch the active Claude Code profile')
  .action(async (name: string) => {
    const baseDir = getProfilesBaseDir();
    const switched = await useAction(name, baseDir);
    if (!switched) {
      console.log(`Profile "${name}" is already active.`);
      return;
    }
    console.log(`Switched to profile: ${name}`);
    console.log('Restart Claude Code for hooks, plugins, and MCP servers to take effect.');
  });
