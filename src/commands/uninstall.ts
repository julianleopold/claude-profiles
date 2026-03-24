import { Command } from 'commander';
import * as p from '@clack/prompts';
import { cp, rm, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { getProfilesBaseDir } from '../core/state.js';
import { listProfiles } from '../core/profile.js';
import { backupExists, getBackupDir } from '../core/backup.js';

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
  .description('Remove claude-profiles and restore your Claude Code config')
  .action(async () => {
    p.intro('claude-profiles uninstall');

    const baseDir = getProfilesBaseDir();
    const claudeDir = join(homedir(), '.claude');
    const profiles = await listProfiles(baseDir);

    const choices: { value: string; label: string }[] = [];
    if (await backupExists(baseDir)) {
      choices.push({ value: '__backup__', label: 'Original config (pre-profiles backup)' });
    }
    for (const profile of profiles) {
      choices.push({ value: profile.name, label: `Profile: ${profile.name}` });
    }

    if (choices.length === 0) {
      p.log.error('No profiles or backup found.');
      return;
    }

    const keepChoice = await p.select({
      message: 'Which config should become your ~/.claude?',
      options: choices,
    });
    if (p.isCancel(keepChoice)) { p.outro('Cancelled.'); return; }

    const confirm = await p.confirm({
      message: `Restore "${keepChoice}" as ~/.claude and remove all profiles?`,
    });
    if (p.isCancel(confirm) || !confirm) { p.outro('Cancelled.'); return; }

    const sourceDir = keepChoice === '__backup__'
      ? getBackupDir(baseDir)
      : join(baseDir, 'profiles', keepChoice as string);

    p.log.step('Restoring config to ~/.claude...');
    if (existsSync(claudeDir)) await rm(claudeDir, { recursive: true, force: true });
    await cp(sourceDir, claudeDir, { recursive: true, dereference: true });

    p.log.step('Removing shell integration...');
    const cleaned = await removeShellIntegration();
    if (cleaned.length > 0) p.log.success(`Removed from: ${cleaned.join(', ')}`);

    p.log.step('Removing ~/.claude-profiles...');
    await rm(baseDir, { recursive: true, force: true });

    p.note('Run: npm uninstall -g claude-profiles', 'Almost done');
    p.outro('Uninstalled. Thanks for trying claude-profiles!');
  });
