import { Command } from 'commander';
import * as p from '@clack/prompts';
import { rm, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { getProfilesBaseDir } from '../core/state.js';

const SENTINEL_START = '# >>> claude-profiles >>>';
const SENTINEL_END = '# <<< claude-profiles <<<';

async function removeShellIntegration(): Promise<string[]> {
  const home = homedir();
  const shellFiles = ['.zshrc', '.bashrc', '.bash_profile', '.config/fish/config.fish']
    .map((f) => join(home, f))
    .filter((f) => existsSync(f));
  const cleaned: string[] = [];

  for (const file of shellFiles) {
    const content = await readFile(file, 'utf-8');
    if (content.includes(SENTINEL_START)) {
      const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\n?${escaped(SENTINEL_START)}[\\s\\S]*?${escaped(SENTINEL_END)}\\n?`, 'g');
      await writeFile(file, content.replace(regex, '\n'));
      cleaned.push(basename(file));
    }
  }
  return cleaned;
}

export const uninstallCommand = new Command('uninstall')
  .description('Remove claude-profiles and restore default ~/.claude config')
  .action(async () => {
    p.intro('claude-profiles uninstall');

    const baseDir = getProfilesBaseDir();

    const confirm = await p.confirm({
      message: 'Remove all profiles and shell integration? (Your ~/.claude stays untouched)',
    });
    if (p.isCancel(confirm) || !confirm) { p.outro('Cancelled.'); return; }

    // Remove shell integration
    p.log.step('Removing shell integration...');
    const cleaned = await removeShellIntegration();
    if (cleaned.length > 0) p.log.success(`Removed from: ${cleaned.join(', ')}`);

    // Remove profiles data
    if (existsSync(baseDir)) {
      p.log.step('Removing ~/.claude-profiles...');
      await rm(baseDir, { recursive: true, force: true });
    }

    p.note(
      'Your ~/.claude config is untouched — Claude Code works as before.\nRun: npm uninstall -g claude-profiles',
      'Done',
    );
    p.outro('Uninstalled. Thanks for trying claude-profiles!');
  });
