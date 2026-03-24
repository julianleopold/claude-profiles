import { describe, it, expect, afterEach } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTestContext, type TestContext } from '../helpers/fixtures';
import { createProfile, listProfiles, deleteProfile } from '../../src/core/profile';
import { switchProfile } from '../../src/core/switcher';
import { loadState } from '../../src/core/state';
import { resolveProfile } from '../../src/core/resolver';
import { togglePlugin, getPluginToggles } from '../../src/core/toggle';
import { setupSharedResources, isSymlink } from '../../src/core/sharing';

describe('Full Workflow', () => {
  let ctx: TestContext;
  afterEach(async () => {
    delete process.env.CLAUDE_CONFIG_DIR;
    await ctx?.cleanup();
  });

  it('complete user journey', async () => {
    ctx = await createTestContext();

    // Init: create default from existing config
    await createProfile(ctx.baseDir, 'default', { fromDir: ctx.claudeDir });
    await setupSharedResources(ctx.baseDir, join(ctx.baseDir, 'profiles', 'default'), ctx.claudeDir, ['plugins', 'projects']);

    // Create ruflo profile
    await createProfile(ctx.baseDir, 'ruflo', { description: 'Ruflo setup' });
    await setupSharedResources(ctx.baseDir, join(ctx.baseDir, 'profiles', 'ruflo'), ctx.claudeDir, ['plugins', 'projects']);

    // Shared resources are symlinked
    expect(isSymlink(join(ctx.baseDir, 'profiles', 'ruflo', 'plugins'))).toBe(true);
    expect(isSymlink(join(ctx.baseDir, 'profiles', 'default', 'plugins'))).toBe(true);

    // Switch to ruflo
    await switchProfile(ctx.baseDir, 'ruflo');
    expect((await loadState(ctx.baseDir)).activeProfile).toBe('ruflo');

    // Toggle plugins differently per profile
    await togglePlugin(ctx.baseDir, 'default', 'superpowers', true);
    await togglePlugin(ctx.baseDir, 'ruflo', 'ruflo-plugin', true);
    expect((await getPluginToggles(ctx.baseDir, 'default'))['superpowers']).toBe(true);
    expect((await getPluginToggles(ctx.baseDir, 'ruflo'))['ruflo-plugin']).toBe(true);
    expect((await getPluginToggles(ctx.baseDir, 'ruflo'))['superpowers']).toBeUndefined();

    // Per-directory resolution
    await writeFile(join(ctx.projectDir, '.claude-profile'), 'ruflo');
    const resolved = await resolveProfile(ctx.baseDir, ctx.projectDir);
    expect(resolved.name).toBe('ruflo');
    expect(resolved.source).toBe('file');

    // List profiles — mark active by CLAUDE_CONFIG_DIR
    process.env.CLAUDE_CONFIG_DIR = join(ctx.baseDir, 'profiles', 'ruflo');
    const profiles = await listProfiles(ctx.baseDir);
    expect(profiles.find((p) => p.name === 'ruflo')?.isActive).toBe(true);
    expect(profiles.find((p) => p.name === 'default')?.isActive).toBe(false);

    // Switch back and delete ruflo
    await switchProfile(ctx.baseDir, 'default');
    delete process.env.CLAUDE_CONFIG_DIR;
    await deleteProfile(ctx.baseDir, 'ruflo');
    expect(await listProfiles(ctx.baseDir)).toHaveLength(1);
  });
});
