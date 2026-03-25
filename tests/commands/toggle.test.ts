import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { createTestContext, type TestContext } from '../helpers/fixtures';
import { toggleAction } from '../../src/commands/toggle';
import { getPluginToggles } from '../../src/core/toggle';

describe('toggle command', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
    process.env.CLAUDE_PROFILES_CLAUDE_DIR = ctx.claudeDir;
  });

  afterEach(async () => {
    delete process.env.CLAUDE_PROFILES_CLAUDE_DIR;
    await ctx?.cleanup();
  });

  it('toggles a plugin on the active profile', async () => {
    await toggleAction('superpowers', true);
    const toggles = await getPluginToggles();
    expect(toggles['superpowers']).toBe(true);
  });
});
