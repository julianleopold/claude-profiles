import { Command } from 'commander';
import * as p from '@clack/prompts';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { getProfilesBaseDir, loadState } from '../core/state.js';
import { createProfile } from '../core/profile.js';

export const initCommand = new Command('init')
  .description('Guided setup for claude-profiles (optional)')
  .action(async () => {
    p.intro('claude-profiles setup');

    const claudeDir = join(homedir(), '.claude');
    if (!existsSync(claudeDir)) {
      p.log.error('No ~/.claude directory found. Install Claude Code first.');
      process.exit(1);
    }

    const baseDir = getProfilesBaseDir();
    const state = await loadState(baseDir);

    p.log.info(`Active profile: ${state.activeProfile}`);
    p.log.info(`Profiles: ${state.profiles.join(', ')}`);

    const createMore = await p.confirm({ message: 'Create a new profile?' });
    if (createMore && !p.isCancel(createMore)) {
      let more = true;
      while (more) {
        const name = await p.text({ message: 'Profile name:', placeholder: 'e.g., ruflo, work' });
        if (p.isCancel(name)) break;
        const desc = await p.text({ message: 'Description (optional):' });
        await createProfile(baseDir, name as string, { description: (desc as string) || undefined });
        p.log.success(`Profile "${name}" created`);
        const again = await p.confirm({ message: 'Create another?' });
        more = !p.isCancel(again) && !!again;
      }
    }

    p.note(
      `claude-profiles create <name>      Create a new profile\nclaude-profiles use <name>         Switch profile (restart Claude Code after)\nclaude-profiles list               See all profiles`,
      'Quick reference',
    );
    p.outro('Done!');
  });
