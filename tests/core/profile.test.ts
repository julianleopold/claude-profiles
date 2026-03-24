import { describe, it, expect, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTestContext, type TestContext } from '../helpers/fixtures';
import {
  createProfile, listProfiles, deleteProfile,
  profileExists, getProfileDir, validateProfileName,
} from '../../src/core/profile';
import { saveState } from '../../src/core/state';

describe('Profile Name Validation', () => {
  it('accepts valid names', () => {
    expect(validateProfileName('default')).toBe(true);
    expect(validateProfileName('my-profile')).toBe(true);
    expect(validateProfileName('work_2')).toBe(true);
  });

  it('rejects invalid names', () => {
    expect(validateProfileName('')).toBe(false);
    expect(validateProfileName('../escape')).toBe(false);
    expect(validateProfileName('has spaces')).toBe(false);
    expect(validateProfileName('/absolute')).toBe(false);
    expect(validateProfileName('.hidden')).toBe(false);
    expect(validateProfileName('-dash')).toBe(false);
    expect(validateProfileName('UPPER')).toBe(false);
  });
});

describe('Profile CRUD', () => {
  let ctx: TestContext;
  afterEach(async () => { await ctx?.cleanup(); });

  it('creates a profile with minimal template', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'work', { description: 'Work' });
    const dir = getProfileDir(ctx.baseDir, 'work');
    expect(existsSync(join(dir, 'settings.json'))).toBe(true);
    expect(existsSync(join(dir, 'CLAUDE.md'))).toBe(true);
  });

  it('creates a profile from existing Claude config', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'imported', { fromDir: ctx.claudeDir });
    const dir = getProfileDir(ctx.baseDir, 'imported');
    const settings = JSON.parse(await readFile(join(dir, 'settings.json'), 'utf-8'));
    expect(settings.model).toBe('claude-sonnet-4-6');
  });

  it('prepends profile name to existing statusline instead of clobbering', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'myprofile', { fromDir: ctx.claudeDir });
    const dir = getProfileDir(ctx.baseDir, 'myprofile');
    const settings = JSON.parse(await readFile(join(dir, 'settings.json'), 'utf-8'));
    expect(settings.statusLine.command).toContain('myprofile');
    expect(settings.statusLine.command).toContain('statusline.sh');
  });

  it('sets statusline on fresh profile (no existing statusline)', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'fresh');
    const dir = getProfileDir(ctx.baseDir, 'fresh');
    const settings = JSON.parse(await readFile(join(dir, 'settings.json'), 'utf-8'));
    expect(settings.statusLine.command).toContain('fresh');
  });

  it('rejects duplicate profile name', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'work');
    await expect(createProfile(ctx.baseDir, 'work')).rejects.toThrow(/already exists/);
  });

  it('rejects invalid profile name', async () => {
    ctx = await createTestContext();
    await expect(createProfile(ctx.baseDir, '../bad')).rejects.toThrow(/invalid/i);
  });

  it('lists profiles', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'alpha');
    await createProfile(ctx.baseDir, 'beta');
    const profiles = await listProfiles(ctx.baseDir);
    expect(profiles.map((p) => p.name)).toContain('alpha');
    expect(profiles.map((p) => p.name)).toContain('beta');
  });

  it('marks active profile based on CLAUDE_CONFIG_DIR env var', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'envactive');
    process.env.CLAUDE_CONFIG_DIR = getProfileDir(ctx.baseDir, 'envactive');
    const profiles = await listProfiles(ctx.baseDir);
    const active = profiles.find((p) => p.name === 'envactive');
    expect(active?.isActive).toBe(true);
    delete process.env.CLAUDE_CONFIG_DIR;
  });

  it('deletes a profile', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'temp');
    await deleteProfile(ctx.baseDir, 'temp');
    expect(await profileExists(ctx.baseDir, 'temp')).toBe(false);
  });

  it('refuses to delete the active profile', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'active');
    await saveState(ctx.baseDir, {
      defaultProfile: 'default', activeProfile: 'active',
      sharedResources: ['plugins', 'projects'], version: '0.1.0',
    });
    await expect(deleteProfile(ctx.baseDir, 'active')).rejects.toThrow(/currently active/);
  });

  it('excludes session-specific dirs when copying from existing config', async () => {
    ctx = await createTestContext();
    const { mkdir: mk } = await import('node:fs/promises');
    await mk(join(ctx.claudeDir, 'sessions'), { recursive: true });
    await mk(join(ctx.claudeDir, 'file-history'), { recursive: true });
    await createProfile(ctx.baseDir, 'clean', { fromDir: ctx.claudeDir });
    const dir = getProfileDir(ctx.baseDir, 'clean');
    expect(existsSync(join(dir, 'sessions'))).toBe(false);
    expect(existsSync(join(dir, 'file-history'))).toBe(false);
  });
});
