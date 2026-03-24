import { describe, it, expect, afterEach } from 'vitest';
import { createTestContext, type TestContext } from '../helpers/fixtures';
import { createProfile } from '../../src/core/profile';
import { switchProfile, getShellExport } from '../../src/core/switcher';
import { loadState } from '../../src/core/state';

describe('Switcher', () => {
  let ctx: TestContext;
  afterEach(async () => { await ctx?.cleanup(); });

  it('switches active profile in state', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'work', { fromDir: ctx.claudeDir });
    await switchProfile(ctx.baseDir, 'work');
    const state = await loadState(ctx.baseDir);
    expect(state.activeProfile).toBe('work');
  });

  it('switching to default sets activeProfile to null', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'work', { fromDir: ctx.claudeDir });
    await switchProfile(ctx.baseDir, 'work');
    await switchProfile(ctx.baseDir, 'default');
    const state = await loadState(ctx.baseDir);
    expect(state.activeProfile).toBeNull();
  });

  it('refuses to switch to non-existent profile', async () => {
    ctx = await createTestContext();
    await expect(switchProfile(ctx.baseDir, 'ghost')).rejects.toThrow(/does not exist/);
  });

  it('generates export for non-default profile', () => {
    const exp = getShellExport('/base', 'dev');
    expect(exp).toBe('export CLAUDE_CONFIG_DIR="/base/profiles/dev"');
  });

  it('generates unset for default profile', () => {
    const exp = getShellExport('/base', 'default');
    expect(exp).toBe('unset CLAUDE_CONFIG_DIR');
  });
});
