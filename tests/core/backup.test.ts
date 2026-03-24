import { describe, it, expect, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTestContext, type TestContext } from '../helpers/fixtures';
import { createBackup, backupExists, getBackupDir } from '../../src/core/backup';

describe('Backup', () => {
  let ctx: TestContext;
  afterEach(async () => { await ctx?.cleanup(); });

  it('creates a backup', async () => {
    ctx = await createTestContext();
    await createBackup(ctx.baseDir, ctx.claudeDir);
    const settings = JSON.parse(await readFile(join(getBackupDir(ctx.baseDir), 'settings.json'), 'utf-8'));
    expect(settings.model).toBe('claude-sonnet-4-6');
  });

  it('never overwrites existing backup', async () => {
    ctx = await createTestContext();
    await createBackup(ctx.baseDir, ctx.claudeDir);
    await writeFile(join(ctx.claudeDir, 'settings.json'), '{"model":"changed"}');
    await createBackup(ctx.baseDir, ctx.claudeDir);
    const settings = JSON.parse(await readFile(join(getBackupDir(ctx.baseDir), 'settings.json'), 'utf-8'));
    expect(settings.model).toBe('claude-sonnet-4-6');
  });

  it('reports backup existence', async () => {
    ctx = await createTestContext();
    expect(await backupExists(ctx.baseDir)).toBe(false);
    await createBackup(ctx.baseDir, ctx.claudeDir);
    expect(await backupExists(ctx.baseDir)).toBe(true);
  });
});
