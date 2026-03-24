import { describe, it, expect, afterEach } from 'vitest';
import { createTestContext, type TestContext } from '../helpers/fixtures';
import { createProfile } from '../../src/core/profile';
import { switchProfile } from '../../src/core/switcher';
import { toggleAction } from '../../src/commands/toggle';
import { getPluginToggles } from '../../src/core/toggle';

describe('toggle command', () => {
  let ctx: TestContext;
  afterEach(async () => { await ctx?.cleanup(); });

  it('toggles a plugin on the active profile', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'test');
    await switchProfile(ctx.baseDir, 'test');
    await toggleAction('superpowers', true, ctx.baseDir);
    expect((await getPluginToggles(ctx.baseDir, 'test'))['superpowers']).toBe(true);
  });
});
