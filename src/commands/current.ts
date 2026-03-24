import { Command } from 'commander';
import { getProfilesBaseDir, loadState } from '../core/state.js';

export const currentCommand = new Command('current')
  .description('Show the active profile')
  .action(async () => {
    const baseDir = getProfilesBaseDir();
    const state = await loadState(baseDir);
    const envDir = process.env.CLAUDE_CONFIG_DIR;

    if (envDir) {
      // Look up CLAUDE_CONFIG_DIR against known profiles
      const match = Object.entries(state.profiles).find(([, path]) => path === envDir);
      if (match) {
        console.log(match[0]);
        return;
      }
      // Unknown CLAUDE_CONFIG_DIR — show it raw
      console.log(`unknown (${envDir})`);
      return;
    }

    console.log(state.activeProfile ?? 'default');
  });
