import { Command } from 'commander';
import { getProfilesBaseDir } from '../core/state.js';
import { createProfile } from '../core/profile.js';

export const createCommand = new Command('create')
  .argument('<name>', 'Profile name (lowercase, hyphens, underscores)')
  .option('-d, --description <desc>', 'Profile description')
  .option('--from <dir>', 'Clone from a specific directory instead of ~/.claude')
  .description('Create a new profile (clones from your current ~/.claude config)')
  .action(async (name: string, opts) => {
    const baseDir = getProfilesBaseDir();
    await createProfile(baseDir, name, { description: opts.description, fromDir: opts.from });
    console.log(`Profile "${name}" created (cloned from ${opts.from ?? '~/.claude'}).`);
    console.log(`Switch to it: claude-profiles use ${name}`);
  });
