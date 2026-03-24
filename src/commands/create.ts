import { Command } from 'commander';
import { join } from 'node:path';
import { getProfilesBaseDir, loadState } from '../core/state.js';
import { createProfile } from '../core/profile.js';
import { setupSharedResources } from '../core/sharing.js';

export const createCommand = new Command('create')
  .argument('<name>', 'Profile name (lowercase, hyphens, underscores)')
  .option('-d, --description <desc>', 'Profile description')
  .option('--from <dir>', 'Clone from an existing Claude config directory')
  .description('Create a new profile')
  .action(async (name: string, opts) => {
    const baseDir = getProfilesBaseDir();
    const state = await loadState(baseDir);
    await createProfile(baseDir, name, { description: opts.description, fromDir: opts.from });
    await setupSharedResources(baseDir, join(baseDir, 'profiles', name), join(baseDir, 'shared'), state.sharedResources);
    console.log(`Profile "${name}" created.`);
    console.log(`Switch to it: claude-profiles use ${name}`);
  });
