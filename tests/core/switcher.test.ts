import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTestContext, type TestContext } from '../helpers/fixtures';
import { createProfile, saveConfigFiles } from '../../src/core/profile';
import { switchProfile } from '../../src/core/switcher';
import { loadState, saveState, getSavedDir } from '../../src/core/state';

describe('Switcher (file-swap)', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
    // Point getClaudeDir() to our test claudeDir
    process.env.CLAUDE_PROFILES_CLAUDE_DIR = ctx.claudeDir;
  });

  afterEach(async () => {
    delete process.env.CLAUDE_PROFILES_CLAUDE_DIR;
    await ctx?.cleanup();
  });

  it('switches active profile in state', async () => {
    await saveConfigFiles(ctx.claudeDir, getSavedDir(ctx.baseDir, 'default'));
    await createProfile(ctx.baseDir, 'work', { fromDir: ctx.claudeDir });

    await switchProfile(ctx.baseDir, 'work');
    const state = await loadState(ctx.baseDir);
    expect(state.activeProfile).toBe('work');
  });

  it('swaps config files in claudeDir', async () => {
    await saveConfigFiles(ctx.claudeDir, getSavedDir(ctx.baseDir, 'default'));
    await createProfile(ctx.baseDir, 'work', { fromDir: ctx.claudeDir });

    await switchProfile(ctx.baseDir, 'work');

    // claudeDir should now have work's statusline (with profile name)
    const settings = JSON.parse(await readFile(join(ctx.claudeDir, 'settings.json'), 'utf-8'));
    expect(settings.statusLine.command).toContain('work');
  });

  it('refuses to switch to non-existent profile', async () => {
    await expect(switchProfile(ctx.baseDir, 'ghost')).rejects.toThrow(/does not exist/);
  });

  it('is a no-op when switching to the already active profile', async () => {
    await saveState(ctx.baseDir, {
      activeProfile: 'default',
      profiles: ['default'],
      version: '0.1.0',
    });
    await switchProfile(ctx.baseDir, 'default');
    const state = await loadState(ctx.baseDir);
    expect(state.activeProfile).toBe('default');
  });
});
