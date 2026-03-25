import { writeFile, rm, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadState, saveState, getSavedDir, getClaudeDir } from './state.js';
import { saveConfigFiles, restoreConfigFiles, installProfileTools } from './profile.js';

const LOCK_FILE = '.switch-lock';
const SWITCH_INTENT_FILE = '.switch-intent';

/**
 * Acquire a simple lockfile. Throws if another switch is in progress.
 */
async function acquireLock(baseDir: string): Promise<void> {
  const lockPath = join(baseDir, LOCK_FILE);
  await mkdir(baseDir, { recursive: true });
  try {
    await writeFile(lockPath, `${process.pid}\n${Date.now()}\n`, { flag: 'wx' });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'EEXIST') {
      // Check if the lock is stale (owner process dead or lock older than 60s)
      try {
        const { readFile: rf } = await import('node:fs/promises');
        const contents = await rf(lockPath, 'utf-8');
        const [pidStr, tsStr] = contents.trim().split('\n');
        const pid = parseInt(pidStr, 10);
        const ts = parseInt(tsStr, 10);
        const isStale = !isNaN(ts) && Date.now() - ts > 60_000;
        let isProcessDead = false;
        if (!isNaN(pid)) {
          try { process.kill(pid, 0); } catch { isProcessDead = true; }
        }
        if (isStale || isProcessDead) {
          await rm(lockPath);
          await writeFile(lockPath, `${process.pid}\n${Date.now()}\n`, { flag: 'wx' });
          return;
        }
      } catch { /* fall through to error */ }
      throw new Error('Another profile switch is in progress. If this is stuck, delete ~/.claude-profiles/.switch-lock');
    }
    throw err;
  }
}

async function releaseLock(baseDir: string): Promise<void> {
  const lockPath = join(baseDir, LOCK_FILE);
  if (existsSync(lockPath)) await rm(lockPath);
}

/**
 * Switch the active profile by swapping config files in ~/.claude.
 *
 * Uses intent file + lockfile for crash safety:
 * 1. Acquire lock (prevent concurrent switches)
 * 2. Write intent (from → to) so we can recover on crash
 * 3. Save current config files from ~/.claude → saved/<current>/
 * 4. Restore saved/<target>/ config files → ~/.claude
 * 5. Re-install our slash commands + hooks
 * 6. Update state.json (marks switch as complete)
 * 7. Remove intent file + lock
 */
export async function switchProfile(baseDir: string, name: string): Promise<boolean> {
  const state = await loadState(baseDir);

  if (!state.profiles.includes(name)) {
    throw new Error(`Profile "${name}" does not exist`);
  }

  if (state.activeProfile === name) {
    return false;
  }

  const claudeDir = getClaudeDir();

  // Check for incomplete previous switch and recover
  await recoverIfNeeded(baseDir, claudeDir);

  await acquireLock(baseDir);

  try {
    // Write intent before starting (for crash recovery)
    const intentPath = join(baseDir, SWITCH_INTENT_FILE);
    await writeFile(intentPath, JSON.stringify({
      from: state.activeProfile,
      to: name,
      timestamp: Date.now(),
    }) + '\n');

    // Save current config
    const currentSavedDir = getSavedDir(baseDir, state.activeProfile);
    await saveConfigFiles(claudeDir, currentSavedDir);

    // Restore target config
    const targetSavedDir = getSavedDir(baseDir, name);
    if (existsSync(targetSavedDir)) {
      await restoreConfigFiles(targetSavedDir, claudeDir);
    }

    // Re-install our tools
    await installProfileTools(claudeDir);

    // Update state (marks switch as complete)
    state.activeProfile = name;
    await saveState(baseDir, state);

    // Clean up intent file
    if (existsSync(intentPath)) await rm(intentPath);
  } finally {
    await releaseLock(baseDir);
  }
  return true;
}

/**
 * If a previous switch was interrupted, recover by completing it.
 */
async function recoverIfNeeded(baseDir: string, claudeDir: string): Promise<void> {
  const intentPath = join(baseDir, SWITCH_INTENT_FILE);
  if (!existsSync(intentPath)) return;

  try {
    const { readFile } = await import('node:fs/promises');
    const intent = JSON.parse(await readFile(intentPath, 'utf-8'));
    const state = await loadState(baseDir);

    // If state still shows the old profile, the switch was interrupted
    // after saving current but before updating state.
    // The target profile's files should be in its saved dir — restore them.
    if (state.activeProfile === intent.from && intent.to) {
      const targetSavedDir = getSavedDir(baseDir, intent.to);
      if (existsSync(targetSavedDir)) {
        await restoreConfigFiles(targetSavedDir, claudeDir);
        state.activeProfile = intent.to;
        await saveState(baseDir, state);
      }
    }

    await rm(intentPath);
  } catch {
    // If recovery fails, just remove the intent file and let the user sort it out
    try { await rm(intentPath); } catch {}
  }
}
