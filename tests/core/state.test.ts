import { describe, it, expect, afterEach } from 'vitest';
import { createTestContext, type TestContext } from '../helpers/fixtures';
import { loadState, saveState } from '../../src/core/state';

describe('State', () => {
  let ctx: TestContext;
  afterEach(async () => { await ctx?.cleanup(); });

  it('returns default state when no file exists', async () => {
    ctx = await createTestContext();
    const state = await loadState(ctx.baseDir);
    expect(state.defaultProfile).toBe('default');
    expect(state.activeProfile).toBeNull();
    expect(state.sharedResources).toContain('plugins');
  });

  it('saves and loads state', async () => {
    ctx = await createTestContext();
    await saveState(ctx.baseDir, {
      defaultProfile: 'work', activeProfile: 'work',
      sharedResources: ['plugins', 'projects'], version: '0.1.0',
    });
    const loaded = await loadState(ctx.baseDir);
    expect(loaded.defaultProfile).toBe('work');
    expect(loaded.activeProfile).toBe('work');
  });
});
