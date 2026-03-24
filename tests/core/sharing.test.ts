import { describe, it, expect, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createTestContext, type TestContext } from '../helpers/fixtures';
import { setupSharedResources, isSymlink } from '../../src/core/sharing';

describe('Shared Resources', () => {
  let ctx: TestContext;
  afterEach(async () => { await ctx?.cleanup(); });

  it('creates shared dir from source and symlinks in profile', async () => {
    ctx = await createTestContext();
    const profileDir = join(ctx.baseDir, 'profiles', 'test');
    await mkdir(profileDir, { recursive: true });
    await setupSharedResources(ctx.baseDir, profileDir, ctx.claudeDir, ['plugins', 'projects']);
    expect(existsSync(join(ctx.baseDir, 'shared', 'plugins'))).toBe(true);
    expect(isSymlink(join(profileDir, 'plugins'))).toBe(true);
    expect(isSymlink(join(profileDir, 'projects'))).toBe(true);
  });

  it('reuses existing shared dir', async () => {
    ctx = await createTestContext();
    await mkdir(join(ctx.baseDir, 'shared', 'plugins'), { recursive: true });
    const profileDir = join(ctx.baseDir, 'profiles', 'second');
    await mkdir(profileDir, { recursive: true });
    await setupSharedResources(ctx.baseDir, profileDir, ctx.claudeDir, ['plugins']);
    expect(isSymlink(join(profileDir, 'plugins'))).toBe(true);
  });
});
