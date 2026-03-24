import { Command } from 'commander';
import { getProfilesBaseDir } from '../core/state.js';
import { listProfiles } from '../core/profile.js';

export const listCommand = new Command('list')
  .alias('ls')
  .description('List all profiles')
  .action(async () => {
    const profiles = await listProfiles(getProfilesBaseDir());
    if (profiles.length === 0) {
      console.log('No profiles found. Run: claude-profiles init');
      return;
    }
    for (const p of profiles) {
      const marker = p.isActive ? '* ' : '  ';
      const name = p.isActive ? `${p.name} (active)` : p.name;
      const def = p.isDefault ? ' [default]' : '';
      const desc = p.config.description ? ` — ${p.config.description}` : '';
      console.log(`${marker}${name}${def}${desc}`);
    }
  });
