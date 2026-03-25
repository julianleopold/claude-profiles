import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTestContext, type TestContext } from '../helpers/fixtures';
import { resolveProfile } from '../../src/core/resolver';
import { saveState } from '../../src/core/state';

describe('Profile Resolver', () => {
  let ctx: TestContext;
  beforeEach(async () => { ctx = await createTestContext(); });
  afterEach(async () => {
    delete process.env.CLAUDE_PROFILES_ACTIVE;
    await ctx?.cleanup();
  });

  it('resolves from CLAUDE_PROFILES_ACTIVE env var', async () => {
    process.env.CLAUDE_PROFILES_ACTIVE = 'env-profile';
    const result = await resolveProfile(ctx.baseDir, ctx.projectDir);
    expect(result).toEqual({ name: 'env-profile', source: 'env' });
  });

  it('resolves from .claude-profile file', async () => {
    await writeFile(join(ctx.projectDir, '.claude-profile'), 'file-profile\n');
    const result = await resolveProfile(ctx.baseDir, ctx.projectDir);
    expect(result.name).toBe('file-profile');
    expect(result.source).toBe('file');
  });

  it('walks up directories to find .claude-profile', async () => {
    const subDir = join(ctx.projectDir, 'src', 'deep');
    await mkdir(subDir, { recursive: true });
    await writeFile(join(ctx.projectDir, '.claude-profile'), 'parent\n');
    const result = await resolveProfile(ctx.baseDir, subDir);
    expect(result.name).toBe('parent');
  });

  it('falls back to active profile from state', async () => {
    await saveState(ctx.baseDir, {
      activeProfile: 'work',
      profiles: ['default', 'work'],
      version: '0.1.0',
    });
    const result = await resolveProfile(ctx.baseDir, ctx.projectDir);
    expect(result.name).toBe('work');
    expect(result.source).toBe('default');
  });

  it('falls back to "default" when no state', async () => {
    const result = await resolveProfile(ctx.baseDir, ctx.projectDir);
    expect(result).toEqual({ name: 'default', source: 'default' });
  });

  it('env var wins over .claude-profile file', async () => {
    process.env.CLAUDE_PROFILES_ACTIVE = 'env-wins';
    await writeFile(join(ctx.projectDir, '.claude-profile'), 'file-loses\n');
    const result = await resolveProfile(ctx.baseDir, ctx.projectDir);
    expect(result.name).toBe('env-wins');
  });
});
