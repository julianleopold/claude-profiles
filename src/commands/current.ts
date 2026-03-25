import { Command } from 'commander';
import { getProfilesBaseDir, loadState } from '../core/state.js';

export const currentCommand = new Command('current')
  .description('Show the active profile')
  .action(async () => {
    const state = await loadState(getProfilesBaseDir());
    console.log(state.activeProfile);
  });
