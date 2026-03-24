import { describe, it, expect, afterEach } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTestContext, type TestContext } from '../helpers/fixtures';
import { createProfile, listProfiles, deleteProfile, getProfileDir } from '../../src/core/profile';
import { switchProfile } from '../../src/core/switcher';
import { loadState } from '../../src/core/state';
import { resolveProfile } from '../../src/core/resolver';
import { togglePlugin, getPluginToggles } from '../../src/core/toggle';

describe('Full Workflow', () => {
  let ctx: TestContext;
  afterEach(async () => {
    delete process.env.CLAUDE_CONFIG_DIR;
    await ctx?.cleanup();
  });

  it('complete user journey', async () => {
    ctx = await createTestContext();

    // Default profile exists automatically (points to ~/.claude)
    const initialProfiles = await listProfiles(ctx.baseDir);
    const def = initialProfiles.find((p) => p.name === 'default');
    expect(def).toBeDefined();
    expect(def?.isActive).toBe(true);

    // Create ruflo profile (clones from source dir)
    await createProfile(ctx.baseDir, 'ruflo', {
      description: 'Ruflo setup',
      fromDir: ctx.claudeDir,
    });

    // Switch to ruflo
    await switchProfile(ctx.baseDir, 'ruflo');
    expect((await loadState(ctx.baseDir)).activeProfile).toBe('ruflo');

    // Toggle plugins differently per profile
    await togglePlugin(ctx.baseDir, 'ruflo', 'ruflo-plugin', true);
    expect((await getPluginToggles(ctx.baseDir, 'ruflo'))['ruflo-plugin']).toBe(true);

    // Per-directory resolution
    await writeFile(join(ctx.projectDir, '.claude-profile'), 'ruflo');
    const resolved = await resolveProfile(ctx.baseDir, ctx.projectDir);
    expect(resolved.name).toBe('ruflo');
    expect(resolved.source).toBe('file');

    // List profiles — mark active by CLAUDE_CONFIG_DIR
    process.env.CLAUDE_CONFIG_DIR = getProfileDir(ctx.baseDir, 'ruflo');
    const profiles = await listProfiles(ctx.baseDir);
    expect(profiles.find((p) => p.name === 'ruflo')?.isActive).toBe(true);
    expect(profiles.find((p) => p.name === 'default')?.isActive).toBe(false);

    // Switch back to default (unsets CLAUDE_CONFIG_DIR)
    await switchProfile(ctx.baseDir, 'default');
    expect((await loadState(ctx.baseDir)).activeProfile).toBeNull();

    // Delete ruflo
    delete process.env.CLAUDE_CONFIG_DIR;
    await deleteProfile(ctx.baseDir, 'ruflo');
    const remaining = await listProfiles(ctx.baseDir);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].name).toBe('default');
  });
});
