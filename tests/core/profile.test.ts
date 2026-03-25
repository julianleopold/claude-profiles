import { describe, it, expect, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createTestContext, type TestContext } from '../helpers/fixtures';
import {
  createProfile, listProfiles, deleteProfile,
  validateProfileName, saveConfigFiles, restoreConfigFiles,
} from '../../src/core/profile';
import { saveState, getSavedDir } from '../../src/core/state';

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

describe('Config File Operations', () => {
  let ctx: TestContext;
  afterEach(async () => { await ctx?.cleanup(); });

  it('saves and restores config files', async () => {
    ctx = await createTestContext();
    const savedDir = join(ctx.baseDir, 'saved', 'test');
    await mkdir(savedDir, { recursive: true });

    // Save from claudeDir
    await saveConfigFiles(ctx.claudeDir, savedDir);
    expect(existsSync(join(savedDir, 'settings.json'))).toBe(true);
    expect(existsSync(join(savedDir, 'CLAUDE.md'))).toBe(true);

    // Modify the original
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(ctx.claudeDir, 'settings.json'), '{"modified": true}');

    // Restore
    await restoreConfigFiles(savedDir, ctx.claudeDir);
    const settings = JSON.parse(await readFile(join(ctx.claudeDir, 'settings.json'), 'utf-8'));
    expect(settings.model).toBe('claude-sonnet-4-6'); // restored original
  });
});

describe('Profile CRUD', () => {
  let ctx: TestContext;
  afterEach(async () => { await ctx?.cleanup(); });

  it('creates a profile from ~/.claude config', async () => {
    ctx = await createTestContext();
    // Use claudeDir as source (simulating ~/.claude)
    await createProfile(ctx.baseDir, 'work', { fromDir: ctx.claudeDir, description: 'Work' });
    const savedDir = getSavedDir(ctx.baseDir, 'work');
    expect(existsSync(join(savedDir, 'settings.json'))).toBe(true);
    const settings = JSON.parse(await readFile(join(savedDir, 'settings.json'), 'utf-8'));
    expect(settings.model).toBe('claude-sonnet-4-6');
  });

  it('injects statusline with profile name', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'myprofile', { fromDir: ctx.claudeDir });
    const savedDir = getSavedDir(ctx.baseDir, 'myprofile');
    const settings = JSON.parse(await readFile(join(savedDir, 'settings.json'), 'utf-8'));
    expect(settings.statusLine.command).toContain('myprofile');
  });

  it('preserves existing statusline command', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'myprofile', { fromDir: ctx.claudeDir });
    const savedDir = getSavedDir(ctx.baseDir, 'myprofile');
    const settings = JSON.parse(await readFile(join(savedDir, 'settings.json'), 'utf-8'));
    expect(settings.statusLine.command).toContain('statusline.sh');
  });

  it('adds profile awareness note to CLAUDE.md', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'myprofile', { fromDir: ctx.claudeDir });
    const savedDir = getSavedDir(ctx.baseDir, 'myprofile');
    const claudeMd = await readFile(join(savedDir, 'CLAUDE.md'), 'utf-8');
    expect(claudeMd).toContain('Active Profile: myprofile');
  });

  it('rejects duplicate profile name', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'work', { fromDir: ctx.claudeDir });
    await expect(createProfile(ctx.baseDir, 'work', { fromDir: ctx.claudeDir })).rejects.toThrow(/already exists/);
  });

  it('rejects invalid profile name', async () => {
    ctx = await createTestContext();
    await expect(createProfile(ctx.baseDir, '../bad')).rejects.toThrow(/invalid/i);
  });

  it('lists profiles including default', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'alpha', { fromDir: ctx.claudeDir });
    const profiles = await listProfiles(ctx.baseDir);
    const names = profiles.map((p) => p.name);
    expect(names).toContain('default');
    expect(names).toContain('alpha');
  });

  it('default is active by default', async () => {
    ctx = await createTestContext();
    const profiles = await listProfiles(ctx.baseDir);
    const def = profiles.find((p) => p.name === 'default');
    expect(def?.isActive).toBe(true);
  });

  it('deletes a profile', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'temp', { fromDir: ctx.claudeDir });
    await deleteProfile(ctx.baseDir, 'temp');
    const profiles = await listProfiles(ctx.baseDir);
    expect(profiles.map((p) => p.name)).not.toContain('temp');
  });

  it('cannot delete default profile', async () => {
    ctx = await createTestContext();
    await expect(deleteProfile(ctx.baseDir, 'default')).rejects.toThrow(/cannot delete/i);
  });

  it('refuses to delete the active profile', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'active', { fromDir: ctx.claudeDir });
    await saveState(ctx.baseDir, {
      activeProfile: 'active',
      profiles: ['default', 'active'],
      version: '0.1.0',
    });
    await expect(deleteProfile(ctx.baseDir, 'active')).rejects.toThrow(/currently active/);
  });
});
