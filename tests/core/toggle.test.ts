import { describe, it, expect, afterEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTestContext, type TestContext } from '../helpers/fixtures';
import { createProfile, getProfileDir } from '../../src/core/profile';
import { togglePlugin, getPluginToggles } from '../../src/core/toggle';

describe('Plugin Toggle', () => {
  let ctx: TestContext;
  afterEach(async () => { await ctx?.cleanup(); });

  it('enables a plugin', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'test');
    await togglePlugin(ctx.baseDir, 'test', 'superpowers@official', true);
    expect((await getPluginToggles(ctx.baseDir, 'test'))['superpowers@official']).toBe(true);
  });

  it('disables a plugin', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'test');
    await togglePlugin(ctx.baseDir, 'test', 'superpowers@official', true);
    await togglePlugin(ctx.baseDir, 'test', 'superpowers@official', false);
    expect((await getPluginToggles(ctx.baseDir, 'test'))['superpowers@official']).toBe(false);
  });

  it('preserves other settings when toggling', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'test', { fromDir: ctx.claudeDir });
    await togglePlugin(ctx.baseDir, 'test', 'myplugin', true);
    const settings = JSON.parse(
      await readFile(join(getProfileDir(ctx.baseDir, 'test'), 'settings.json'), 'utf-8'),
    );
    expect(settings.model).toBe('claude-sonnet-4-6');
    expect(settings.enabledPlugins.myplugin).toBe(true);
  });
});
