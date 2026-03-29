import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { getProfilesBaseDir, loadState } from './state.js';

/**
 * Profile scripts: shell scripts that run when a profile is loaded.
 * Stored in ~/.claude-profiles/scripts/<name>.sh
 * Loaded by the Notification hook to inject profile-specific context.
 */

export function getScriptsDir(baseDir: string): string {
  return join(baseDir, 'scripts');
}

export function getProfileScriptPath(baseDir: string, profileName: string): string {
  return join(getScriptsDir(baseDir), `${profileName}.sh`);
}

export function profileScriptExists(baseDir: string, profileName: string): boolean {
  return existsSync(getProfileScriptPath(baseDir, profileName));
}

/**
 * Run a profile's startup script and return its stdout.
 * Falls back to default.sh if no profile-specific script exists.
 * Returns empty string if no script is found.
 */
export function runProfileScript(baseDir: string, profileName: string): string {
  const profileScript = getProfileScriptPath(baseDir, profileName);
  const defaultScript = getProfileScriptPath(baseDir, 'default');

  let scriptPath: string | null = null;
  if (existsSync(profileScript)) {
    scriptPath = profileScript;
  } else if (existsSync(defaultScript)) {
    scriptPath = defaultScript;
  }

  if (!scriptPath) return '';

  try {
    return execFileSync('bash', [scriptPath], {
      encoding: 'utf-8',
      timeout: 5000,
      env: { ...process.env, CLAUDE_PROFILE: profileName },
    }).trim();
  } catch {
    return '';
  }
}

/**
 * Resolve the active profile and run its script.
 * Used by the Notification hook handler.
 */
export async function runActiveProfileScript(baseDir?: string): Promise<string> {
  const dir = baseDir ?? getProfilesBaseDir();
  const state = await loadState(dir);
  return runProfileScript(dir, state.activeProfile);
}

/**
 * Create a template profile script.
 */
export async function createProfileScript(baseDir: string, profileName: string): Promise<void> {
  const scriptsDir = getScriptsDir(baseDir);
  await mkdir(scriptsDir, { recursive: true });

  const scriptPath = getProfileScriptPath(baseDir, profileName);
  if (existsSync(scriptPath)) return; // Don't overwrite existing

  const template = `#!/usr/bin/env bash
# Profile startup script for "${profileName}"
# This runs when the Notification hook fires while this profile is active.
# Output is injected as additional context for Claude.
#
# Available environment variable:
#   CLAUDE_PROFILE — name of the active profile
#
# Examples:
#   echo "Project: $(basename "$PWD")"
#   echo "Branch: $(git branch --show-current 2>/dev/null)"
#   echo "Node: $(node -v 2>/dev/null)"
exit 0
`;
  await writeFile(scriptPath, template, { mode: 0o755 });
}

/**
 * Ensure the scripts directory exists.
 */
export async function ensureScriptsDir(baseDir: string): Promise<void> {
  await mkdir(getScriptsDir(baseDir), { recursive: true });
}
