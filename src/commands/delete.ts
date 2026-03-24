import { Command } from 'commander';
import * as p from '@clack/prompts';
import { getProfilesBaseDir } from '../core/state.js';
import { deleteProfile } from '../core/profile.js';

export const deleteCommand = new Command('delete')
  .argument('<name>', 'Profile to delete')
  .option('-f, --force', 'Skip confirmation')
  .description('Delete a profile')
  .action(async (name: string, opts) => {
    if (!opts.force) {
      const confirm = await p.confirm({ message: `Delete profile "${name}"?` });
      if (p.isCancel(confirm) || !confirm) { console.log('Cancelled.'); return; }
    }
    await deleteProfile(getProfilesBaseDir(), name);
    console.log(`Profile "${name}" deleted.`);
  });
