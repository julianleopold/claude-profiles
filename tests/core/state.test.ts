import { describe, it, expect, afterEach } from 'vitest';
import { createTestContext, type TestContext } from '../helpers/fixtures';
import { loadState, saveState } from '../../src/core/state';

describe('State', () => {
  let ctx: TestContext;
  afterEach(async () => { await ctx?.cleanup(); });

  it('returns default state when no file exists', async () => {
    ctx = await createTestContext();
    const state = await loadState(ctx.baseDir);
    expect(state.activeProfile).toBe('default');
    expect(state.profiles).toContain('default');
  });

  it('saves and loads state', async () => {
    ctx = await createTestContext();
    await saveState(ctx.baseDir, {
      activeProfile: 'work',
      profiles: ['default', 'work'],
      version: '0.1.0',
    });
    const loaded = await loadState(ctx.baseDir);
    expect(loaded.activeProfile).toBe('work');
    expect(loaded.profiles).toContain('work');
    expect(loaded.profiles).toContain('default');
  });
});
