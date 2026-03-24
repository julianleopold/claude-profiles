import { Command } from 'commander';
import { getProfilesBaseDir, loadState } from '../core/state.js';

export const currentCommand = new Command('current')
  .description('Show the active profile')
  .action(async () => {
    const baseDir = getProfilesBaseDir();
    const envDir = process.env.CLAUDE_CONFIG_DIR;
    if (envDir && envDir.includes('/profiles/')) {
      const name = envDir.split('/profiles/').pop();
      console.log(name);
      return;
    }
    const state = await loadState(baseDir);
    console.log(state.activeProfile ?? state.defaultProfile);
  });
