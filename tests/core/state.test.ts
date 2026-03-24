import { describe, it, expect, afterEach } from 'vitest';
import { createTestContext, type TestContext } from '../helpers/fixtures';
import { loadState, saveState } from '../../src/core/state';

describe('State', () => {
  let ctx: TestContext;
  afterEach(async () => { await ctx?.cleanup(); });

  it('returns default state when no file exists', async () => {
    ctx = await createTestContext();
    const state = await loadState(ctx.baseDir);
    expect(state.activeProfile).toBeNull();
    expect(state.profiles.default).toBeDefined();
  });

  it('saves and loads state', async () => {
    ctx = await createTestContext();
    await saveState(ctx.baseDir, {
      profiles: { ruflo: '/some/path' },
      activeProfile: 'ruflo',
      version: '0.1.0',
    });
    const loaded = await loadState(ctx.baseDir);
    expect(loaded.activeProfile).toBe('ruflo');
    expect(loaded.profiles.ruflo).toBe('/some/path');
    expect(loaded.profiles.default).toBeDefined();
  });
});
