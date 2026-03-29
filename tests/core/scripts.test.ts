import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { createTestContext, type TestContext } from '../helpers/fixtures';
import {
  getScriptsDir,
  getProfileScriptPath,
  profileScriptExists,
  runProfileScript,
  createProfileScript,
  ensureScriptsDir,
} from '../../src/core/scripts';

describe('Profile Scripts', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
    process.env.CLAUDE_PROFILES_CLAUDE_DIR = ctx.claudeDir;
  });

  afterEach(async () => {
    delete process.env.CLAUDE_PROFILES_CLAUDE_DIR;
    await ctx?.cleanup();
  });

  it('getScriptsDir returns correct path', () => {
    expect(getScriptsDir(ctx.baseDir)).toBe(join(ctx.baseDir, 'scripts'));
  });

  it('getProfileScriptPath returns correct path', () => {
    expect(getProfileScriptPath(ctx.baseDir, 'work')).toBe(
      join(ctx.baseDir, 'scripts', 'work.sh'),
    );
  });

  it('profileScriptExists returns false when no script', () => {
    expect(profileScriptExists(ctx.baseDir, 'work')).toBe(false);
  });

  it('profileScriptExists returns true after creating script', async () => {
    await createProfileScript(ctx.baseDir, 'work');
    expect(profileScriptExists(ctx.baseDir, 'work')).toBe(true);
  });

  it('createProfileScript creates a template script', async () => {
    await createProfileScript(ctx.baseDir, 'work');
    const scriptPath = getProfileScriptPath(ctx.baseDir, 'work');
    expect(existsSync(scriptPath)).toBe(true);
    const content = await readFile(scriptPath, 'utf-8');
    expect(content).toContain('#!/usr/bin/env bash');
    expect(content).toContain('work');
    expect(content).toContain('CLAUDE_PROFILE');
  });

  it('createProfileScript does not overwrite existing script', async () => {
    const scriptsDir = getScriptsDir(ctx.baseDir);
    await mkdir(scriptsDir, { recursive: true });
    const scriptPath = getProfileScriptPath(ctx.baseDir, 'work');
    await writeFile(scriptPath, '#!/bin/bash\necho "custom"');

    await createProfileScript(ctx.baseDir, 'work');
    const content = await readFile(scriptPath, 'utf-8');
    expect(content).toContain('echo "custom"');
  });

  it('ensureScriptsDir creates the scripts directory', async () => {
    await ensureScriptsDir(ctx.baseDir);
    expect(existsSync(getScriptsDir(ctx.baseDir))).toBe(true);
  });

  it('runProfileScript executes script and returns output', async () => {
    const scriptsDir = getScriptsDir(ctx.baseDir);
    await mkdir(scriptsDir, { recursive: true });
    await writeFile(
      getProfileScriptPath(ctx.baseDir, 'work'),
      '#!/bin/bash\necho "hello from work"',
      { mode: 0o755 },
    );

    const output = runProfileScript(ctx.baseDir, 'work');
    expect(output).toBe('hello from work');
  });

  it('runProfileScript falls back to default.sh', async () => {
    const scriptsDir = getScriptsDir(ctx.baseDir);
    await mkdir(scriptsDir, { recursive: true });
    await writeFile(
      getProfileScriptPath(ctx.baseDir, 'default'),
      '#!/bin/bash\necho "default script"',
      { mode: 0o755 },
    );

    const output = runProfileScript(ctx.baseDir, 'nonexistent');
    expect(output).toBe('default script');
  });

  it('runProfileScript returns empty string when no scripts exist', () => {
    const output = runProfileScript(ctx.baseDir, 'work');
    expect(output).toBe('');
  });

  it('runProfileScript passes CLAUDE_PROFILE env var', async () => {
    const scriptsDir = getScriptsDir(ctx.baseDir);
    await mkdir(scriptsDir, { recursive: true });
    await writeFile(
      getProfileScriptPath(ctx.baseDir, 'work'),
      '#!/bin/bash\necho "$CLAUDE_PROFILE"',
      { mode: 0o755 },
    );

    const output = runProfileScript(ctx.baseDir, 'work');
    expect(output).toBe('work');
  });

  it('runProfileScript returns empty on script error', async () => {
    const scriptsDir = getScriptsDir(ctx.baseDir);
    await mkdir(scriptsDir, { recursive: true });
    await writeFile(
      getProfileScriptPath(ctx.baseDir, 'work'),
      '#!/bin/bash\nexit 1',
      { mode: 0o755 },
    );

    const output = runProfileScript(ctx.baseDir, 'work');
    expect(output).toBe('');
  });
});
