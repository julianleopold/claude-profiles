import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import type { ResolvedProfile } from '../types.js';
import { loadState } from './state.js';

const PROFILE_FILE = '.claude-profile';

export async function resolveProfile(baseDir: string, cwd: string): Promise<ResolvedProfile> {
  const env = process.env.CLAUDE_PROFILES_ACTIVE;
  if (env) return { name: env.trim(), source: 'env' };

  let current = cwd;
  while (true) {
    const filePath = join(current, PROFILE_FILE);
    if (existsSync(filePath)) {
      try {
        const name = (await readFile(filePath, 'utf-8')).trim();
        if (name) return { name, source: 'file', filePath };
      } catch {}
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  const state = await loadState(baseDir);
  return { name: state.defaultProfile, source: 'default' };
}
