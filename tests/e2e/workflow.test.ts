import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTestContext, type TestContext } from '../helpers/fixtures';
import { createProfile, listProfiles, deleteProfile, saveConfigFiles } from '../../src/core/profile';
import { switchProfile } from '../../src/core/switcher';
import { loadState, getSavedDir } from '../../src/core/state';
import { resolveProfile } from '../../src/core/resolver';

describe('Full Workflow (file-swap)', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
    process.env.CLAUDE_PROFILES_CLAUDE_DIR = ctx.claudeDir;
  });

  afterEach(async () => {
    delete process.env.CLAUDE_PROFILES_CLAUDE_DIR;
    await ctx?.cleanup();
  });

  it('complete user journey', async () => {
    // Save default config
    await saveConfigFiles(ctx.claudeDir, getSavedDir(ctx.baseDir, 'default'));

    // Default profile exists and is active
    const initial = await listProfiles(ctx.baseDir);
    expect(initial.find((p) => p.name === 'default')?.isActive).toBe(true);

    // Create ruflo profile
    await createProfile(ctx.baseDir, 'ruflo', {
      description: 'Ruflo setup',
      fromDir: ctx.claudeDir,
    });

    // Verify ruflo saved config has statusline
    const rufloSettings = JSON.parse(
      await readFile(join(getSavedDir(ctx.baseDir, 'ruflo'), 'settings.json'), 'utf-8'),
    );
    expect(rufloSettings.statusLine.command).toContain('ruflo');

    // Switch to ruflo (swaps files in claudeDir)
    await switchProfile(ctx.baseDir, 'ruflo');
    expect((await loadState(ctx.baseDir)).activeProfile).toBe('ruflo');

    // Verify claudeDir now has ruflo's statusline
    const activeSettings = JSON.parse(await readFile(join(ctx.claudeDir, 'settings.json'), 'utf-8'));
    expect(activeSettings.statusLine.command).toContain('ruflo');

    // Per-directory resolution
    await writeFile(join(ctx.projectDir, '.claude-profile'), 'ruflo');
    const resolved = await resolveProfile(ctx.baseDir, ctx.projectDir);
    expect(resolved.name).toBe('ruflo');

    // List profiles
    const profiles = await listProfiles(ctx.baseDir);
    expect(profiles).toHaveLength(2);
    expect(profiles.find((p) => p.name === 'ruflo')?.isActive).toBe(true);
    expect(profiles.find((p) => p.name === 'default')?.isActive).toBe(false);

    // Switch back to default
    await switchProfile(ctx.baseDir, 'default');
    expect((await loadState(ctx.baseDir)).activeProfile).toBe('default');

    // Verify claudeDir restored default's settings (no ruflo in statusline)
    const defaultSettings = JSON.parse(await readFile(join(ctx.claudeDir, 'settings.json'), 'utf-8'));
    expect(defaultSettings.statusLine.command).not.toContain('ruflo');

    // Delete ruflo
    await deleteProfile(ctx.baseDir, 'ruflo');
    expect(await listProfiles(ctx.baseDir)).toHaveLength(1);
  });
});
