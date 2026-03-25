import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTestContext, type TestContext } from '../helpers/fixtures';
import { togglePlugin, getPluginToggles } from '../../src/core/toggle';

describe('Plugin Toggle', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
    process.env.CLAUDE_PROFILES_CLAUDE_DIR = ctx.claudeDir;
  });

  afterEach(async () => {
    delete process.env.CLAUDE_PROFILES_CLAUDE_DIR;
    await ctx?.cleanup();
  });

  it('enables a plugin', async () => {
    await togglePlugin('test-plugin', true);
    const toggles = await getPluginToggles();
    expect(toggles['test-plugin']).toBe(true);
  });

  it('disables a plugin', async () => {
    await togglePlugin('test-plugin', true);
    await togglePlugin('test-plugin', false);
    const toggles = await getPluginToggles();
    expect(toggles['test-plugin']).toBe(false);
  });

  it('preserves other settings when toggling', async () => {
    await togglePlugin('myplugin', true);
    const settings = JSON.parse(
      await readFile(join(ctx.claudeDir, 'settings.json'), 'utf-8'),
    );
    expect(settings.model).toBe('claude-sonnet-4-6');
    expect(settings.enabledPlugins.myplugin).toBe(true);
  });
});
