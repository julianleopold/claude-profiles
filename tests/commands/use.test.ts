import { describe, it, expect, afterEach } from 'vitest';
import { createTestContext, type TestContext } from '../helpers/fixtures';
import { createProfile } from '../../src/core/profile';
import { loadState } from '../../src/core/state';
import { useAction } from '../../src/commands/use';

describe('use command', () => {
  let ctx: TestContext;
  afterEach(async () => { await ctx?.cleanup(); });

  it('switches to specified profile', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'work');
    await useAction('work', ctx.baseDir);
    expect((await loadState(ctx.baseDir)).activeProfile).toBe('work');
  });

  it('throws for non-existent profile', async () => {
    ctx = await createTestContext();
    await expect(useAction('ghost', ctx.baseDir)).rejects.toThrow();
  });
});
