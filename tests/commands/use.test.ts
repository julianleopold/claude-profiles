import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { createTestContext, type TestContext } from '../helpers/fixtures';
import { createProfile, saveConfigFiles } from '../../src/core/profile';
import { loadState, getSavedDir } from '../../src/core/state';
import { useAction } from '../../src/commands/use';

describe('use command', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
    process.env.CLAUDE_PROFILES_CLAUDE_DIR = ctx.claudeDir;
  });

  afterEach(async () => {
    delete process.env.CLAUDE_PROFILES_CLAUDE_DIR;
    await ctx?.cleanup();
  });

  it('switches to specified profile', async () => {
    await saveConfigFiles(ctx.claudeDir, getSavedDir(ctx.baseDir, 'default'));
    await createProfile(ctx.baseDir, 'work', { fromDir: ctx.claudeDir });
    await useAction('work', ctx.baseDir);
    expect((await loadState(ctx.baseDir)).activeProfile).toBe('work');
  });

  it('throws for non-existent profile', async () => {
    await expect(useAction('ghost', ctx.baseDir)).rejects.toThrow();
  });
});
