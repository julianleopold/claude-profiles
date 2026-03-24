# claude-profiles v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal, lean profile switcher for Claude Code that lets users swap between isolated configurations (settings, hooks, MCP servers, plugins, commands) with per-directory auto-switching. Easy to install, easy to uninstall, zero overhead.

**Architecture:** Profiles are directories under `~/.claude-profiles/profiles/<name>/`, each a complete Claude Code config dir. Switching sets `CLAUDE_CONFIG_DIR` via a shell hook. Plugin cache is shared via symlinks; `enabledPlugins` in each profile's `settings.json` controls what's active. Resolution chain: `$CLAUDE_PROFILES_ACTIVE` env var → `.claude-profile` file (walk up dirs) → state file default → `"default"`.

**Tech Stack:** TypeScript, Commander.js (CLI), @clack/prompts (init/uninstall wizards only), tsup (bundle). Distributed via npm. Shell integration via `eval "$(claude-profiles shell-init)"`.

**Design Principles:**
- **Lean** — 9 commands, small deps, fast startup, no background processes
- **Easy in, easy out** — `npm i -g claude-profiles && claude-profiles init` / `claude-profiles uninstall`
- **Reversible** — backup original config, uninstall restores cleanly
- **No surprises** — loud restart warnings, auto-detect shell, preserve existing statuslines

**Design Influences:** pyenv (resolution chain), direnv (shell hook on cd), nvm (.nvmrc), conda (sentinel comments for shell config).

**Out of scope (v2):** Per-profile git VCS, export/import, profile composition/layering, template marketplace, MCP toggle (edit `mcp.json` directly for now), `diff` command, `run` command, `doctor` command.

---

## CLI Commands (v1)

```
claude-profiles init                        # First-time setup + auto-add shell hook
claude-profiles create <name>               # Create a new profile
claude-profiles use <name>                  # Switch active profile (warns to restart)
claude-profiles list                        # List profiles (* = active from $CLAUDE_CONFIG_DIR)
claude-profiles current                     # Show active profile name
claude-profiles delete <name>               # Safe delete with confirmation
claude-profiles toggle plugin <name> on|off # Enable/disable plugin in active profile
claude-profiles shell-init                  # Output shell hook (auto-detects shell)
claude-profiles uninstall                   # Clean removal, choose config to keep
```

Also available as `/profiles` slash command inside Claude Code.

---

## File Structure

```
claude-profiles/
├── src/
│   ├── index.ts                    # CLI entry point, Commander setup
│   ├── commands/
│   │   ├── init.ts                 # First-time setup wizard
│   │   ├── create.ts               # Create a new profile
│   │   ├── use.ts                  # Switch active profile
│   │   ├── list.ts                 # List profiles with status
│   │   ├── current.ts              # Show active profile
│   │   ├── delete.ts               # Safe profile deletion
│   │   ├── uninstall.ts            # Clean uninstall
│   │   ├── toggle.ts               # Enable/disable plugins per profile
│   │   └── shell-init.ts           # Output shell hook code
│   ├── core/
│   │   ├── state.ts                # Global state (~/.claude-profiles/state.json)
│   │   ├── profile.ts              # Profile CRUD, name validation, statusline
│   │   ├── resolver.ts             # Profile resolution chain
│   │   ├── switcher.ts             # Set CLAUDE_CONFIG_DIR, update state
│   │   ├── sharing.ts              # Shared resource symlink management
│   │   └── backup.ts               # Original ~/.claude backup
│   ├── claude-commands/
│   │   └── profiles.md             # /profiles slash command
│   └── types.ts                    # Shared TypeScript types
├── tests/
│   ├── core/
│   │   ├── state.test.ts
│   │   ├── profile.test.ts
│   │   ├── resolver.test.ts
│   │   ├── switcher.test.ts
│   │   ├── sharing.test.ts
│   │   └── backup.test.ts
│   ├── commands/
│   │   ├── use.test.ts
│   │   ├── toggle.test.ts
│   │   └── shell-init.test.ts
│   ├── e2e/
│   │   └── workflow.test.ts
│   └── helpers/
│       └── fixtures.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── LICENSE
└── README.md
```

### Data directory (`~/.claude-profiles/`)

```
~/.claude-profiles/
├── state.json                      # { defaultProfile, activeProfile, sharedResources, version }
├── .pre-profiles-backup/           # Original ~/.claude/ snapshot (never modified)
├── profiles/
│   ├── default/                    # Profile dir = Claude Code config dir
│   │   ├── settings.json           # enabledPlugins, hooks, permissions, statusLine
│   │   ├── settings.local.json
│   │   ├── mcp.json
│   │   ├── CLAUDE.md
│   │   ├── commands/
│   │   ├── plugins/                # Symlink → shared/plugins
│   │   └── projects/               # Symlink → shared/projects
│   └── ruflo/
│       ├── settings.json
│       ├── mcp.json
│       ├── CLAUDE.md
│       ├── commands/
│       ├── plugins/                # Symlink → shared/plugins
│       └── projects/               # Symlink → shared/projects
└── shared/
    ├── plugins/                    # Actual plugin cache
    └── projects/                   # Actual projects/session data
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/index.ts`
- Create: `src/types.ts`
- Create: `.gitignore`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "claude-profiles",
  "version": "0.1.0",
  "description": "Profile switcher for Claude Code — swap settings, hooks, MCP servers, and commands between configurations",
  "type": "module",
  "bin": {
    "claude-profiles": "./dist/index.js"
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --clean",
    "dev": "tsx src/index.ts",
    "test": "vitest",
    "test:run": "vitest run",
    "lint": "tsc --noEmit"
  },
  "keywords": [
    "claude-code", "profiles", "configuration", "mcp", "ai-agents",
    "claude", "anthropic", "developer-tools", "cli", "profile-switcher",
    "config-management", "direnv", "nvm"
  ],
  "author": "julianleopold",
  "license": "MIT",
  "engines": { "node": ">=20.0.0" },
  "files": [
    "dist/**",
    "src/claude-commands/**",
    "README.md",
    "LICENSE"
  ]
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/julianleopold/code/claude-profiles
npm install commander @clack/prompts
npm install -D typescript tsx tsup vitest @types/node
```

Note: No `chalk` — use Node 22's `styleText` from `node:util` with a simple fallback for Node 20/21. Keeps deps minimal.

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { globals: true, environment: 'node' },
});
```

- [ ] **Step 5: Create src/types.ts**

```typescript
export interface State {
  defaultProfile: string;
  activeProfile: string | null;
  sharedResources: SharedResource[];
  version: string;
}

export type SharedResource = 'plugins' | 'projects';

export interface ProfileConfig {
  name: string;
  description?: string;
  createdAt: string;
}

export interface ProfileInfo {
  name: string;
  path: string;
  config: ProfileConfig;
  isActive: boolean;
  isDefault: boolean;
}

export interface ClaudeSettings {
  enabledPlugins?: Record<string, boolean>;
  hooks?: Record<string, unknown>;
  permissions?: { allow?: string[]; deny?: string[] };
  statusLine?: { type: string; command: string };
  [key: string]: unknown;
}

export interface ClaudeMcpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface ResolvedProfile {
  name: string;
  source: 'env' | 'file' | 'default';
  filePath?: string;
}

/** Valid profile names: lowercase alphanumeric, hyphens, underscores, 1-63 chars */
export const PROFILE_NAME_REGEX = /^[a-z0-9][a-z0-9_-]{0,62}$/;
```

- [ ] **Step 6: Create src/index.ts (minimal)**

```typescript
#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();
program
  .name('claude-profiles')
  .description('Profile switcher for Claude Code')
  .version('0.1.0');
program.parse();
```

- [ ] **Step 7: Create .gitignore**

```
node_modules/
dist/
*.tsbuildinfo
.env
.env.*
```

- [ ] **Step 8: Verify**

Run: `cd /Users/julianleopold/code/claude-profiles && npm run lint`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts src/index.ts src/types.ts .gitignore
git commit -m "feat: project scaffolding with types and CLI entry point"
```

---

## Task 2: Core — State & Profile CRUD

**Files:**
- Create: `src/core/state.ts`
- Create: `src/core/profile.ts`
- Create: `tests/helpers/fixtures.ts`
- Create: `tests/core/state.test.ts`
- Create: `tests/core/profile.test.ts`

- [ ] **Step 1: Create test fixtures**

```typescript
// tests/helpers/fixtures.ts
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface TestContext {
  baseDir: string;
  claudeDir: string;
  projectDir: string;
  cleanup: () => Promise<void>;
}

export async function createTestContext(): Promise<TestContext> {
  const baseDir = await mkdtemp(join(tmpdir(), 'cp-test-'));
  const claudeDir = await mkdtemp(join(tmpdir(), 'cp-claude-'));
  const projectDir = await mkdtemp(join(tmpdir(), 'cp-project-'));

  // Minimal existing Claude config
  await writeFile(join(claudeDir, 'settings.json'), JSON.stringify({
    model: 'claude-sonnet-4-6',
    statusLine: { type: 'command', command: 'bash ~/.claude/statusline.sh' },
  }, null, 2));
  await writeFile(join(claudeDir, 'CLAUDE.md'), '# My Instructions\n');
  await mkdir(join(claudeDir, 'plugins', 'cache'), { recursive: true });
  await mkdir(join(claudeDir, 'projects'), { recursive: true });

  return {
    baseDir, claudeDir, projectDir,
    cleanup: async () => {
      await rm(baseDir, { recursive: true, force: true });
      await rm(claudeDir, { recursive: true, force: true });
      await rm(projectDir, { recursive: true, force: true });
    },
  };
}
```

- [ ] **Step 2: Write failing tests for state.ts**

```typescript
// tests/core/state.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { createTestContext, type TestContext } from '../helpers/fixtures';
import { loadState, saveState } from '../../src/core/state';

describe('State', () => {
  let ctx: TestContext;
  afterEach(async () => { await ctx?.cleanup(); });

  it('returns default state when no file exists', async () => {
    ctx = await createTestContext();
    const state = await loadState(ctx.baseDir);
    expect(state.defaultProfile).toBe('default');
    expect(state.activeProfile).toBeNull();
    expect(state.sharedResources).toContain('plugins');
  });

  it('saves and loads state', async () => {
    ctx = await createTestContext();
    await saveState(ctx.baseDir, {
      defaultProfile: 'work', activeProfile: 'work',
      sharedResources: ['plugins', 'projects'], version: '0.1.0',
    });
    const loaded = await loadState(ctx.baseDir);
    expect(loaded.defaultProfile).toBe('work');
    expect(loaded.activeProfile).toBe('work');
  });
});
```

- [ ] **Step 3: Write failing tests for profile.ts (including name validation and statusline)**

```typescript
// tests/core/profile.test.ts
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
    // Should preserve the original statusline command too
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
    // Create dirs that should NOT be copied
    await mk(join(ctx.claudeDir, 'sessions'), { recursive: true });
    await mk(join(ctx.claudeDir, 'file-history'), { recursive: true });
    await createProfile(ctx.baseDir, 'clean', { fromDir: ctx.claudeDir });
    const dir = getProfileDir(ctx.baseDir, 'clean');
    expect(existsSync(join(dir, 'sessions'))).toBe(false);
    expect(existsSync(join(dir, 'file-history'))).toBe(false);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd /Users/julianleopold/code/claude-profiles && npx vitest run tests/core/`
Expected: FAIL — modules not found

- [ ] **Step 5: Implement src/core/state.ts**

```typescript
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { State } from '../types.js';

const DEFAULT_STATE: State = {
  defaultProfile: 'default',
  activeProfile: null,
  sharedResources: ['plugins', 'projects'],
  version: '0.1.0',
};

export function getProfilesBaseDir(): string {
  return process.env.CLAUDE_PROFILES_HOME ?? join(homedir(), '.claude-profiles');
}

export async function loadState(baseDir?: string): Promise<State> {
  const dir = baseDir ?? getProfilesBaseDir();
  try {
    const raw = await readFile(join(dir, 'state.json'), 'utf-8');
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function saveState(baseDir: string, state: State): Promise<void> {
  await mkdir(baseDir, { recursive: true });
  await writeFile(join(baseDir, 'state.json'), JSON.stringify(state, null, 2) + '\n');
}
```

- [ ] **Step 6: Implement src/core/profile.ts**

```typescript
import { mkdir, cp, readdir, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { PROFILE_NAME_REGEX, type ProfileConfig, type ProfileInfo, type ClaudeSettings } from '../types.js';
import { loadState } from './state.js';

/** Dirs that should NOT be copied from an existing ~/.claude config */
const EXCLUDED_DIRS = new Set([
  'plugins', 'projects', 'sessions', 'file-history',
  'debug', 'shell-snapshots', 'session-env', 'backups',
  'todos', 'tasks', 'statslog',
]);

/** Files that should NOT be copied */
const EXCLUDED_FILES = new Set([
  'history.jsonl', 'stats-cache.json', '.session-stats.json',
]);

export function validateProfileName(name: string): boolean {
  return PROFILE_NAME_REGEX.test(name);
}

export function getProfileDir(baseDir: string, name: string): string {
  return join(baseDir, 'profiles', name);
}

export async function profileExists(baseDir: string, name: string): Promise<boolean> {
  return existsSync(getProfileDir(baseDir, name));
}

function makeStatusLine(profileName: string, existingCommand?: string): { type: string; command: string } {
  if (existingCommand) {
    // Prepend profile name to existing statusline output
    return {
      type: 'command',
      command: `echo -n "${profileName} | " && ${existingCommand}`,
    };
  }
  return {
    type: 'command',
    command: `echo "${profileName} |"`,
  };
}

export async function createProfile(
  baseDir: string,
  name: string,
  options: { description?: string; fromDir?: string } = {},
): Promise<string> {
  if (!validateProfileName(name)) {
    throw new Error(
      `Invalid profile name "${name}". Use lowercase alphanumeric, hyphens, underscores. Must start with a letter or number.`,
    );
  }
  if (await profileExists(baseDir, name)) {
    throw new Error(`Profile "${name}" already exists`);
  }

  const profileDir = getProfileDir(baseDir, name);
  await mkdir(profileDir, { recursive: true });

  let existingStatusLineCommand: string | undefined;

  if (options.fromDir) {
    const entries = await readdir(options.fromDir, { withFileTypes: true });
    for (const entry of entries) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      if (EXCLUDED_FILES.has(entry.name)) continue;
      await cp(join(options.fromDir, entry.name), join(profileDir, entry.name), { recursive: true });
    }
    // Read existing statusline before we overwrite
    try {
      const existing: ClaudeSettings = JSON.parse(
        await readFile(join(profileDir, 'settings.json'), 'utf-8'),
      );
      existingStatusLineCommand = existing.statusLine?.command;
    } catch {}
  } else {
    await writeFile(join(profileDir, 'settings.json'), '{}\n');
    await writeFile(
      join(profileDir, 'CLAUDE.md'),
      `# ${name} Profile\n\nClaude Code instructions for the "${name}" profile.\n`,
    );
  }

  // Inject statusline (prepend to existing, or create new)
  const settingsPath = join(profileDir, 'settings.json');
  let settings: ClaudeSettings = {};
  try { settings = JSON.parse(await readFile(settingsPath, 'utf-8')); } catch {}
  settings.statusLine = makeStatusLine(name, existingStatusLineCommand);
  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');

  // Write profile metadata
  const config: ProfileConfig = { name, description: options.description, createdAt: new Date().toISOString() };
  await writeFile(join(profileDir, '.profile.json'), JSON.stringify(config, null, 2) + '\n');

  return profileDir;
}

export async function listProfiles(baseDir: string): Promise<ProfileInfo[]> {
  const profilesDir = join(baseDir, 'profiles');
  if (!existsSync(profilesDir)) return [];

  const state = await loadState(baseDir);
  // Check CLAUDE_CONFIG_DIR env var first (actual shell state), fall back to state file
  const envConfigDir = process.env.CLAUDE_CONFIG_DIR;

  const entries = await readdir(profilesDir, { withFileTypes: true });
  const profiles: ProfileInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const profileDir = join(profilesDir, entry.name);
    let config: ProfileConfig = { name: entry.name, createdAt: 'unknown' };
    try { config = JSON.parse(await readFile(join(profileDir, '.profile.json'), 'utf-8')); } catch {}

    const isActiveByEnv = envConfigDir ? envConfigDir === profileDir : false;
    const isActiveByState = !envConfigDir && state.activeProfile === entry.name;

    profiles.push({
      name: entry.name,
      path: profileDir,
      config,
      isActive: isActiveByEnv || isActiveByState,
      isDefault: entry.name === state.defaultProfile,
    });
  }

  return profiles.sort((a, b) => a.name.localeCompare(b.name));
}

export async function deleteProfile(baseDir: string, name: string): Promise<void> {
  if (!(await profileExists(baseDir, name))) {
    throw new Error(`Profile "${name}" does not exist`);
  }
  const state = await loadState(baseDir);
  const envConfigDir = process.env.CLAUDE_CONFIG_DIR;
  const profileDir = getProfileDir(baseDir, name);
  const isActive = envConfigDir ? envConfigDir === profileDir : state.activeProfile === name;
  if (isActive) {
    throw new Error(`Cannot delete "${name}" — it is currently active. Switch first.`);
  }
  await rm(profileDir, { recursive: true, force: true });
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd /Users/julianleopold/code/claude-profiles && npx vitest run tests/core/`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/core/state.ts src/core/profile.ts tests/
git commit -m "feat: state management and profile CRUD with validation and statusline"
```

---

## Task 3: Core — Profile Resolution Chain

**Files:**
- Create: `src/core/resolver.ts`
- Create: `tests/core/resolver.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/core/resolver.test.ts
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTestContext, type TestContext } from '../helpers/fixtures';
import { resolveProfile } from '../../src/core/resolver';

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

  it('resolves from state.json default when no file found', async () => {
    const { saveState } = await import('../../src/core/state');
    await saveState(ctx.baseDir, {
      defaultProfile: 'my-default', activeProfile: null,
      sharedResources: ['plugins', 'projects'], version: '0.1.0',
    });
    const result = await resolveProfile(ctx.baseDir, ctx.projectDir);
    expect(result.name).toBe('my-default');
    expect(result.source).toBe('default');
  });

  it('falls back to "default"', async () => {
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
```

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement src/core/resolver.ts**

```typescript
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import type { ResolvedProfile } from '../types.js';
import { loadState } from './state.js';

const PROFILE_FILE = '.claude-profile';

export async function resolveProfile(baseDir: string, cwd: string): Promise<ResolvedProfile> {
  // 1. Env var (highest priority)
  const env = process.env.CLAUDE_PROFILES_ACTIVE;
  if (env) return { name: env.trim(), source: 'env' };

  // 2. .claude-profile file (walk up)
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

  // 3. State file default
  const state = await loadState(baseDir);
  return { name: state.defaultProfile, source: 'default' };
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/core/resolver.ts tests/core/resolver.test.ts
git commit -m "feat: pyenv-style profile resolution chain"
```

---

## Task 4: Core — Backup & Shared Symlinks

**Files:**
- Create: `src/core/backup.ts`
- Create: `src/core/sharing.ts`
- Create: `tests/core/backup.test.ts`
- Create: `tests/core/sharing.test.ts`

- [ ] **Step 1: Write failing tests for backup**

```typescript
// tests/core/backup.test.ts
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
```

- [ ] **Step 2: Write failing tests for sharing**

```typescript
// tests/core/sharing.test.ts
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
```

- [ ] **Step 3: Run tests — expect FAIL**

- [ ] **Step 4: Implement src/core/backup.ts**

```typescript
import { cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function getBackupDir(baseDir: string): string {
  return join(baseDir, '.pre-profiles-backup');
}

export async function backupExists(baseDir: string): Promise<boolean> {
  return existsSync(getBackupDir(baseDir));
}

export async function createBackup(baseDir: string, claudeDir: string): Promise<void> {
  if (await backupExists(baseDir)) return;
  await mkdir(getBackupDir(baseDir), { recursive: true });
  await cp(claudeDir, getBackupDir(baseDir), { recursive: true });
}
```

- [ ] **Step 5: Implement src/core/sharing.ts**

```typescript
import { cp, mkdir, symlink, rm } from 'node:fs/promises';
import { existsSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import type { SharedResource } from '../types.js';

export function isSymlink(path: string): boolean {
  try { return lstatSync(path).isSymbolicLink(); } catch { return false; }
}

export async function setupSharedResources(
  baseDir: string, profileDir: string, sourceDir: string, resources: SharedResource[],
): Promise<void> {
  const sharedBase = join(baseDir, 'shared');
  await mkdir(sharedBase, { recursive: true });

  for (const resource of resources) {
    const sharedPath = join(sharedBase, resource);
    const profilePath = join(profileDir, resource);
    const sourcePath = join(sourceDir, resource);

    if (!existsSync(sharedPath)) {
      existsSync(sourcePath)
        ? await cp(sourcePath, sharedPath, { recursive: true })
        : await mkdir(sharedPath, { recursive: true });
    }

    if (existsSync(profilePath) && !isSymlink(profilePath)) {
      await rm(profilePath, { recursive: true, force: true });
    }
    if (!existsSync(profilePath)) {
      await symlink(sharedPath, profilePath);
    }
  }
}
```

- [ ] **Step 6: Run tests — expect PASS**

- [ ] **Step 7: Commit**

```bash
git add src/core/backup.ts src/core/sharing.ts tests/core/backup.test.ts tests/core/sharing.test.ts
git commit -m "feat: backup safety net and shared resource symlinks"
```

---

## Task 5: Core — Profile Switcher

**Files:**
- Create: `src/core/switcher.ts`
- Create: `tests/core/switcher.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/core/switcher.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { createTestContext, type TestContext } from '../helpers/fixtures';
import { createProfile } from '../../src/core/profile';
import { switchProfile, getShellExport } from '../../src/core/switcher';
import { loadState } from '../../src/core/state';

describe('Switcher', () => {
  let ctx: TestContext;
  afterEach(async () => { await ctx?.cleanup(); });

  it('switches active profile in state', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'work');
    await switchProfile(ctx.baseDir, 'work');
    const state = await loadState(ctx.baseDir);
    expect(state.activeProfile).toBe('work');
  });

  it('refuses to switch to non-existent profile', async () => {
    ctx = await createTestContext();
    await expect(switchProfile(ctx.baseDir, 'ghost')).rejects.toThrow(/does not exist/);
  });

  it('generates correct shell export', () => {
    const exp = getShellExport('/base', 'dev');
    expect(exp).toBe('export CLAUDE_CONFIG_DIR="/base/profiles/dev"');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement src/core/switcher.ts**

```typescript
import { profileExists, getProfileDir } from './profile.js';
import { loadState, saveState } from './state.js';

export async function switchProfile(baseDir: string, name: string): Promise<void> {
  if (!(await profileExists(baseDir, name))) {
    throw new Error(`Profile "${name}" does not exist`);
  }
  const state = await loadState(baseDir);
  state.activeProfile = name;
  await saveState(baseDir, state);
}

export function getShellExport(baseDir: string, profileName: string): string {
  return `export CLAUDE_CONFIG_DIR="${getProfileDir(baseDir, profileName)}"`;
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/core/switcher.ts tests/core/switcher.test.ts
git commit -m "feat: profile switcher with state management"
```

---

## Task 6: Core — Plugin Toggle

**Files:**
- Create: `src/core/toggle.ts`
- Create: `tests/core/toggle.test.ts`

Plugin toggle only for v1. MCP server management is done by editing `mcp.json` directly.

- [ ] **Step 1: Write failing tests**

```typescript
// tests/core/toggle.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTestContext, type TestContext } from '../helpers/fixtures';
import { createProfile, getProfileDir } from '../../src/core/profile';
import { togglePlugin, getPluginToggles } from '../../src/core/toggle';

describe('Plugin Toggle', () => {
  let ctx: TestContext;
  afterEach(async () => { await ctx?.cleanup(); });

  it('enables a plugin', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'test');
    await togglePlugin(ctx.baseDir, 'test', 'superpowers@official', true);
    expect((await getPluginToggles(ctx.baseDir, 'test'))['superpowers@official']).toBe(true);
  });

  it('disables a plugin', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'test');
    await togglePlugin(ctx.baseDir, 'test', 'superpowers@official', true);
    await togglePlugin(ctx.baseDir, 'test', 'superpowers@official', false);
    expect((await getPluginToggles(ctx.baseDir, 'test'))['superpowers@official']).toBe(false);
  });

  it('preserves other settings when toggling', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'test', { fromDir: ctx.claudeDir });
    await togglePlugin(ctx.baseDir, 'test', 'myplugin', true);
    const settings = JSON.parse(
      await readFile(join(getProfileDir(ctx.baseDir, 'test'), 'settings.json'), 'utf-8'),
    );
    expect(settings.model).toBe('claude-sonnet-4-6'); // preserved
    expect(settings.enabledPlugins.myplugin).toBe(true); // added
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement src/core/toggle.ts**

```typescript
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getProfileDir } from './profile.js';
import type { ClaudeSettings } from '../types.js';

async function readSettings(profileDir: string): Promise<ClaudeSettings> {
  try { return JSON.parse(await readFile(join(profileDir, 'settings.json'), 'utf-8')); }
  catch { return {}; }
}

async function writeSettings(profileDir: string, settings: ClaudeSettings): Promise<void> {
  await writeFile(join(profileDir, 'settings.json'), JSON.stringify(settings, null, 2) + '\n');
}

export async function togglePlugin(
  baseDir: string, profileName: string, pluginId: string, enabled: boolean,
): Promise<void> {
  const profileDir = getProfileDir(baseDir, profileName);
  const settings = await readSettings(profileDir);
  settings.enabledPlugins = settings.enabledPlugins ?? {};
  settings.enabledPlugins[pluginId] = enabled;
  await writeSettings(profileDir, settings);
}

export async function getPluginToggles(
  baseDir: string, profileName: string,
): Promise<Record<string, boolean>> {
  const profileDir = getProfileDir(baseDir, profileName);
  const settings = await readSettings(profileDir);
  return settings.enabledPlugins ?? {};
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/core/toggle.ts tests/core/toggle.test.ts
git commit -m "feat: plugin toggle per profile"
```

---

## Task 7: Shell Integration (Auto-Switch Hook)

**Files:**
- Create: `src/commands/shell-init.ts`
- Create: `tests/commands/shell-init.test.ts`

Uses conda-style sentinel comments for clean install/uninstall. Auto-detects shell from `$SHELL`.

- [ ] **Step 1: Write failing tests**

```typescript
// tests/commands/shell-init.test.ts
import { describe, it, expect } from 'vitest';
import { getShellInitScript, detectShell } from '../../src/commands/shell-init';

describe('shell-init', () => {
  it('wraps output in sentinel comments', () => {
    const script = getShellInitScript('zsh');
    expect(script).toContain('# >>> claude-profiles >>>');
    expect(script).toContain('# <<< claude-profiles <<<');
  });

  it('zsh uses chpwd hook', () => {
    const script = getShellInitScript('zsh');
    expect(script).toContain('chpwd');
    expect(script).toContain('_claude_profiles_hook');
  });

  it('bash uses PROMPT_COMMAND', () => {
    const script = getShellInitScript('bash');
    expect(script).toContain('PROMPT_COMMAND');
  });

  it('fish uses --on-variable PWD', () => {
    const script = getShellInitScript('fish');
    expect(script).toContain('--on-variable PWD');
  });

  it('hook sets CLAUDE_CONFIG_DIR and warns on missing profiles', () => {
    const script = getShellInitScript('zsh');
    expect(script).toContain('CLAUDE_CONFIG_DIR');
    expect(script).toContain('CLAUDE_PROFILES_ACTIVE');
    expect(script).toContain('Warning');
  });

  it('detects shell from $SHELL env var', () => {
    const orig = process.env.SHELL;
    process.env.SHELL = '/bin/zsh';
    expect(detectShell()).toBe('zsh');
    process.env.SHELL = '/usr/local/bin/fish';
    expect(detectShell()).toBe('fish');
    process.env.SHELL = '/bin/bash';
    expect(detectShell()).toBe('bash');
    process.env.SHELL = orig;
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement src/commands/shell-init.ts**

```typescript
import { basename } from 'node:path';

export function detectShell(): string {
  const shell = process.env.SHELL ?? '';
  const name = basename(shell);
  if (name === 'fish') return 'fish';
  if (name === 'bash') return 'bash';
  return 'zsh'; // default
}

export function getShellInitScript(shell: string): string {
  if (shell === 'fish') return wrapSentinel(getFishHook());
  return wrapSentinel(getPosixHook(shell));
}

function wrapSentinel(content: string): string {
  return `# >>> claude-profiles >>>
# !! Contents within this block are managed by claude-profiles !!
${content}
# <<< claude-profiles <<<`;
}

function getPosixHook(shell: string): string {
  const hookSetup = shell === 'bash'
    ? `if [[ ";$PROMPT_COMMAND;" != *";_claude_profiles_hook;"* ]]; then
    PROMPT_COMMAND="_claude_profiles_hook;$PROMPT_COMMAND"
  fi`
    : `autoload -U add-zsh-hook
  add-zsh-hook chpwd _claude_profiles_hook`;

  return `_claude_profiles_hook() {
  local base_dir="\${CLAUDE_PROFILES_HOME:-$HOME/.claude-profiles}"
  local profile_file=""
  local search_dir="$PWD"

  while [ "$search_dir" != "/" ]; do
    if [ -f "$search_dir/.claude-profile" ]; then
      profile_file="$search_dir/.claude-profile"
      break
    fi
    search_dir="$(dirname "$search_dir")"
  done

  if [ -n "$profile_file" ]; then
    local target_profile
    target_profile="$(cat "$profile_file" | tr -d '[:space:]')"
    local profile_dir="$base_dir/profiles/$target_profile"

    if [ -d "$profile_dir" ]; then
      if [ "$CLAUDE_CONFIG_DIR" != "$profile_dir" ]; then
        export CLAUDE_CONFIG_DIR="$profile_dir"
        export CLAUDE_PROFILES_ACTIVE="$target_profile"
        echo "[claude-profiles] Switched to: $target_profile"
      fi
    else
      echo "[claude-profiles] Warning: profile '$target_profile' not found (from $profile_file)"
    fi
  elif [ -n "$CLAUDE_PROFILES_ACTIVE" ]; then
    local default_profile="default"
    if [ -f "$base_dir/state.json" ]; then
      local parsed
      parsed="$(grep -o '"defaultProfile":"[^"]*"' "$base_dir/state.json" | head -1 | cut -d'"' -f4)"
      [ -n "$parsed" ] && default_profile="$parsed"
    fi
    local default_dir="$base_dir/profiles/$default_profile"
    if [ -d "$default_dir" ]; then
      export CLAUDE_CONFIG_DIR="$default_dir"
      export CLAUDE_PROFILES_ACTIVE="$default_profile"
    fi
  fi
}

_claude_profiles_hook

${hookSetup}`;
}

function getFishHook(): string {
  return `function _claude_profiles_hook --on-variable PWD
  set -l base_dir (test -n "$CLAUDE_PROFILES_HOME"; and echo $CLAUDE_PROFILES_HOME; or echo $HOME/.claude-profiles)
  set -l search_dir $PWD
  set -l profile_file ""

  while test "$search_dir" != "/"
    if test -f "$search_dir/.claude-profile"
      set profile_file "$search_dir/.claude-profile"
      break
    end
    set search_dir (dirname "$search_dir")
  end

  if test -n "$profile_file"
    set -l target_profile (string trim (cat "$profile_file"))
    set -l profile_dir "$base_dir/profiles/$target_profile"
    if test -d "$profile_dir"
      if test "$CLAUDE_CONFIG_DIR" != "$profile_dir"
        set -gx CLAUDE_CONFIG_DIR "$profile_dir"
        set -gx CLAUDE_PROFILES_ACTIVE "$target_profile"
        echo "[claude-profiles] Switched to: $target_profile"
      end
    else
      echo "[claude-profiles] Warning: profile '$target_profile' not found"
    end
  else if test -n "$CLAUDE_PROFILES_ACTIVE"
    set -l default_profile "default"
    set -l default_dir "$base_dir/profiles/$default_profile"
    if test -d "$default_dir"
      set -gx CLAUDE_CONFIG_DIR "$default_dir"
      set -gx CLAUDE_PROFILES_ACTIVE "$default_profile"
    end
  end
end

_claude_profiles_hook`;
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/commands/shell-init.ts tests/commands/shell-init.test.ts
git commit -m "feat: direnv-style shell hook with auto-detect and sentinel comments"
```

---

## Task 8: CLI Commands

**Files:**
- Create: `src/commands/init.ts`
- Create: `src/commands/create.ts`
- Create: `src/commands/use.ts`
- Create: `src/commands/list.ts`
- Create: `src/commands/current.ts`
- Create: `src/commands/delete.ts`
- Create: `src/commands/toggle.ts`
- Create: `src/commands/uninstall.ts`
- Create: `tests/commands/use.test.ts`
- Create: `tests/commands/toggle.test.ts`

- [ ] **Step 1: Write failing test for use command**

```typescript
// tests/commands/use.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { createTestContext, type TestContext } from '../helpers/fixtures';
import { createProfile } from '../../src/core/profile';
import { loadState } from '../../src/core/state';
import { useAction } from '../../src/commands/use';

describe('use command', () => {
  let ctx: TestContext;
  afterEach(async () => { await ctx?.cleanup(); });

  it('switches to specified profile', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'work');
    await useAction('work', ctx.baseDir);
    expect((await loadState(ctx.baseDir)).activeProfile).toBe('work');
  });

  it('throws for non-existent profile', async () => {
    ctx = await createTestContext();
    await expect(useAction('ghost', ctx.baseDir)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Write failing test for toggle command**

```typescript
// tests/commands/toggle.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { createTestContext, type TestContext } from '../helpers/fixtures';
import { createProfile } from '../../src/core/profile';
import { switchProfile } from '../../src/core/switcher';
import { toggleAction } from '../../src/commands/toggle';
import { getPluginToggles } from '../../src/core/toggle';

describe('toggle command', () => {
  let ctx: TestContext;
  afterEach(async () => { await ctx?.cleanup(); });

  it('toggles a plugin on the active profile', async () => {
    ctx = await createTestContext();
    await createProfile(ctx.baseDir, 'test');
    await switchProfile(ctx.baseDir, 'test');
    await toggleAction('superpowers', true, ctx.baseDir);
    expect((await getPluginToggles(ctx.baseDir, 'test'))['superpowers']).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL**

- [ ] **Step 4: Implement src/commands/use.ts**

```typescript
import { Command } from 'commander';
import { getProfilesBaseDir } from '../core/state.js';
import { switchProfile } from '../core/switcher.js';
import { getProfileDir } from '../core/profile.js';

export async function useAction(name: string, baseDir?: string): Promise<void> {
  await switchProfile(baseDir ?? getProfilesBaseDir(), name);
}

export const useCommand = new Command('use')
  .argument('<name>', 'Profile to switch to')
  .description('Switch the active Claude Code profile')
  .action(async (name: string) => {
    const baseDir = getProfilesBaseDir();
    await useAction(name, baseDir);
    const profileDir = getProfileDir(baseDir, name);
    console.log(`Switched to profile: ${name}`);
    console.log(`CLAUDE_CONFIG_DIR=${profileDir}`);
    console.log('');
    console.log('>>> RESTART CLAUDE CODE for changes to take effect <<<');
    console.log('(The shell hook will pick this up in new terminals automatically)');
  });
```

- [ ] **Step 5: Implement src/commands/list.ts**

```typescript
import { Command } from 'commander';
import { getProfilesBaseDir } from '../core/state.js';
import { listProfiles } from '../core/profile.js';

export const listCommand = new Command('list')
  .alias('ls')
  .description('List all profiles')
  .action(async () => {
    const profiles = await listProfiles(getProfilesBaseDir());
    if (profiles.length === 0) {
      console.log('No profiles found. Run: claude-profiles init');
      return;
    }
    for (const p of profiles) {
      const marker = p.isActive ? '* ' : '  ';
      const name = p.isActive ? `${p.name} (active)` : p.name;
      const def = p.isDefault ? ' [default]' : '';
      const desc = p.config.description ? ` — ${p.config.description}` : '';
      console.log(`${marker}${name}${def}${desc}`);
    }
  });
```

- [ ] **Step 6: Implement src/commands/current.ts**

```typescript
import { Command } from 'commander';
import { getProfilesBaseDir, loadState } from '../core/state.js';
import { getProfileDir } from '../core/profile.js';

export const currentCommand = new Command('current')
  .description('Show the active profile')
  .action(async () => {
    const baseDir = getProfilesBaseDir();
    // Check env var first (actual shell state)
    const envDir = process.env.CLAUDE_CONFIG_DIR;
    if (envDir && envDir.includes('/profiles/')) {
      const name = envDir.split('/profiles/').pop();
      console.log(name);
      return;
    }
    const state = await loadState(baseDir);
    console.log(state.activeProfile ?? state.defaultProfile);
  });
```

- [ ] **Step 7: Implement src/commands/create.ts**

```typescript
import { Command } from 'commander';
import { join } from 'node:path';
import { getProfilesBaseDir, loadState } from '../core/state.js';
import { createProfile } from '../core/profile.js';
import { setupSharedResources } from '../core/sharing.js';

export const createCommand = new Command('create')
  .argument('<name>', 'Profile name (lowercase, hyphens, underscores)')
  .option('-d, --description <desc>', 'Profile description')
  .option('--from <dir>', 'Clone from an existing Claude config directory')
  .description('Create a new profile')
  .action(async (name: string, opts) => {
    const baseDir = getProfilesBaseDir();
    const state = await loadState(baseDir);
    await createProfile(baseDir, name, { description: opts.description, fromDir: opts.from });
    await setupSharedResources(baseDir, join(baseDir, 'profiles', name), join(baseDir, 'shared'), state.sharedResources);
    console.log(`Profile "${name}" created.`);
    console.log(`Switch to it: claude-profiles use ${name}`);
  });
```

- [ ] **Step 8: Implement src/commands/delete.ts**

```typescript
import { Command } from 'commander';
import * as p from '@clack/prompts';
import { getProfilesBaseDir } from '../core/state.js';
import { deleteProfile } from '../core/profile.js';

export const deleteCommand = new Command('delete')
  .argument('<name>', 'Profile to delete')
  .option('-f, --force', 'Skip confirmation')
  .description('Delete a profile')
  .action(async (name: string, opts) => {
    if (!opts.force) {
      const confirm = await p.confirm({ message: `Delete profile "${name}"?` });
      if (p.isCancel(confirm) || !confirm) { console.log('Cancelled.'); return; }
    }
    await deleteProfile(getProfilesBaseDir(), name);
    console.log(`Profile "${name}" deleted.`);
  });
```

- [ ] **Step 9: Implement src/commands/toggle.ts**

```typescript
import { Command } from 'commander';
import { getProfilesBaseDir, loadState } from '../core/state.js';
import { togglePlugin } from '../core/toggle.js';

export async function toggleAction(
  pluginName: string, enabled: boolean, baseDir?: string,
): Promise<void> {
  const dir = baseDir ?? getProfilesBaseDir();
  const state = await loadState(dir);
  if (!state.activeProfile) throw new Error('No active profile. Run: claude-profiles init');
  await togglePlugin(dir, state.activeProfile, pluginName, enabled);
}

export const toggleCommand = new Command('toggle')
  .command('plugin')
  .argument('<name>', 'Plugin name')
  .argument('<state>', '"on" or "off"')
  .description('Enable/disable a plugin in the active profile')
  .action(async (name: string, state: string) => {
    const enabled = state === 'on';
    await toggleAction(name, enabled);
    console.log(`Plugin "${name}" ${enabled ? 'enabled' : 'disabled'}`);
    console.log('Restart Claude Code for changes to take effect.');
  });
```

- [ ] **Step 10: Implement src/commands/init.ts (auto-adds shell hook)**

```typescript
import { Command } from 'commander';
import * as p from '@clack/prompts';
import { homedir } from 'node:os';
import { join, basename } from 'node:path';
import { existsSync } from 'node:fs';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { getProfilesBaseDir, saveState } from '../core/state.js';
import { createProfile } from '../core/profile.js';
import { createBackup } from '../core/backup.js';
import { setupSharedResources } from '../core/sharing.js';
import { switchProfile } from '../core/switcher.js';
import { getShellInitScript, detectShell } from './shell-init.js';
import type { State, SharedResource } from '../types.js';

const SENTINEL_START = '# >>> claude-profiles >>>';

function getShellConfigPath(): string {
  const shell = detectShell();
  const home = homedir();
  if (shell === 'fish') return join(home, '.config', 'fish', 'config.fish');
  if (shell === 'bash') return join(home, '.bashrc');
  return join(home, '.zshrc');
}

export const initCommand = new Command('init')
  .description('Set up claude-profiles for the first time')
  .action(async () => {
    p.intro('claude-profiles setup');

    const baseDir = getProfilesBaseDir();
    const claudeDir = join(homedir(), '.claude');

    if (!existsSync(claudeDir)) {
      p.log.error('No ~/.claude directory found. Install Claude Code first.');
      process.exit(1);
    }

    // Backup
    p.log.step('Backing up current ~/.claude config...');
    await createBackup(baseDir, claudeDir);
    p.log.success('Backup created');

    // Create default profile
    const sharedResources: SharedResource[] = ['plugins', 'projects'];
    p.log.step('Creating "default" profile from current config...');
    await createProfile(baseDir, 'default', {
      description: 'Default profile (from existing config)',
      fromDir: claudeDir,
    });
    await setupSharedResources(baseDir, join(baseDir, 'profiles', 'default'), claudeDir, sharedResources);

    const state: State = {
      defaultProfile: 'default', activeProfile: 'default',
      sharedResources, version: '0.1.0',
    };
    await saveState(baseDir, state);
    p.log.success('Default profile created and activated');

    // Offer to create additional profiles
    const createMore = await p.confirm({ message: 'Create additional profiles now?' });
    if (createMore && !p.isCancel(createMore)) {
      let more = true;
      while (more) {
        const name = await p.text({ message: 'Profile name:', placeholder: 'e.g., ruflo, work' });
        if (p.isCancel(name)) break;
        const desc = await p.text({ message: 'Description (optional):' });
        await createProfile(baseDir, name as string, { description: (desc as string) || undefined });
        await setupSharedResources(baseDir, join(baseDir, 'profiles', name as string), claudeDir, sharedResources);
        p.log.success(`Profile "${name}" created`);
        const again = await p.confirm({ message: 'Create another?' });
        more = !p.isCancel(again) && !!again;
      }
    }

    // Auto-add shell hook
    const shellConfig = getShellConfigPath();
    let hookAlreadyInstalled = false;
    if (existsSync(shellConfig)) {
      const content = await readFile(shellConfig, 'utf-8');
      hookAlreadyInstalled = content.includes(SENTINEL_START);
    }

    if (!hookAlreadyInstalled) {
      const addHook = await p.confirm({
        message: `Add shell hook to ${basename(shellConfig)}? (enables auto-switching per project)`,
      });
      if (addHook && !p.isCancel(addHook)) {
        const shell = detectShell();
        const hookScript = getShellInitScript(shell);
        await appendFile(shellConfig, '\n' + hookScript + '\n');
        p.log.success(`Shell hook added to ${basename(shellConfig)}`);
      } else {
        p.note(`Add manually later:\n  eval "$(claude-profiles shell-init)"`, 'Shell hook');
      }
    } else {
      p.log.info('Shell hook already installed');
    }

    p.note(
      `claude-profiles use <name>         Switch profile\nclaude-profiles list               See all profiles\necho "ruflo" > .claude-profile     Auto-switch per project`,
      'Quick reference',
    );
    p.outro('Setup complete!');
  });
```

- [ ] **Step 11: Implement src/commands/uninstall.ts**

```typescript
import { Command } from 'commander';
import * as p from '@clack/prompts';
import { cp, rm, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { getProfilesBaseDir } from '../core/state.js';
import { listProfiles } from '../core/profile.js';
import { backupExists, getBackupDir } from '../core/backup.js';

const SENTINEL_START = '# >>> claude-profiles >>>';
const SENTINEL_END = '# <<< claude-profiles <<<';

async function removeShellIntegration(): Promise<string[]> {
  const home = homedir();
  const shellFiles = ['.zshrc', '.bashrc', '.bash_profile', '.config/fish/config.fish']
    .map((f) => join(home, f))
    .filter((f) => existsSync(f));
  const cleaned: string[] = [];

  for (const file of shellFiles) {
    const content = await readFile(file, 'utf-8');
    if (content.includes(SENTINEL_START)) {
      const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\n?${escaped(SENTINEL_START)}[\\s\\S]*?${escaped(SENTINEL_END)}\\n?`, 'g');
      await writeFile(file, content.replace(regex, '\n'));
      cleaned.push(basename(file));
    }
  }
  return cleaned;
}

export const uninstallCommand = new Command('uninstall')
  .description('Remove claude-profiles and restore your Claude Code config')
  .action(async () => {
    p.intro('claude-profiles uninstall');

    const baseDir = getProfilesBaseDir();
    const claudeDir = join(homedir(), '.claude');
    const profiles = await listProfiles(baseDir);

    const choices: { value: string; label: string }[] = [];
    if (await backupExists(baseDir)) {
      choices.push({ value: '__backup__', label: 'Original config (pre-profiles backup)' });
    }
    for (const profile of profiles) {
      choices.push({ value: profile.name, label: `Profile: ${profile.name}` });
    }

    if (choices.length === 0) {
      p.log.error('No profiles or backup found.');
      return;
    }

    const keepChoice = await p.select({
      message: 'Which config should become your ~/.claude?',
      options: choices,
    });
    if (p.isCancel(keepChoice)) { p.outro('Cancelled.'); return; }

    const confirm = await p.confirm({
      message: `Restore "${keepChoice}" as ~/.claude and remove all profiles?`,
    });
    if (p.isCancel(confirm) || !confirm) { p.outro('Cancelled.'); return; }

    // Restore chosen config (dereference symlinks so we get real files)
    const sourceDir = keepChoice === '__backup__'
      ? getBackupDir(baseDir)
      : join(baseDir, 'profiles', keepChoice as string);

    p.log.step('Restoring config to ~/.claude...');
    if (existsSync(claudeDir)) await rm(claudeDir, { recursive: true, force: true });
    await cp(sourceDir, claudeDir, { recursive: true, dereference: true });

    // Remove shell integration
    p.log.step('Removing shell integration...');
    const cleaned = await removeShellIntegration();
    if (cleaned.length > 0) p.log.success(`Removed from: ${cleaned.join(', ')}`);

    // Remove profiles data
    p.log.step('Removing ~/.claude-profiles...');
    await rm(baseDir, { recursive: true, force: true });

    p.note('Run: npm uninstall -g claude-profiles', 'Almost done');
    p.outro('Uninstalled. Thanks for trying claude-profiles!');
  });
```

- [ ] **Step 12: Run tests — expect PASS**

Run: `cd /Users/julianleopold/code/claude-profiles && npx vitest run tests/commands/`

- [ ] **Step 13: Commit**

```bash
git add src/commands/
git commit -m "feat: all CLI commands — init, create, use, list, current, delete, toggle, uninstall"
```

---

## Task 9: Wire CLI & Slash Command

**Files:**
- Modify: `src/index.ts`
- Create: `src/claude-commands/profiles.md`

- [ ] **Step 1: Wire all commands in src/index.ts**

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { createCommand } from './commands/create.js';
import { useCommand } from './commands/use.js';
import { listCommand } from './commands/list.js';
import { currentCommand } from './commands/current.js';
import { deleteCommand } from './commands/delete.js';
import { toggleCommand } from './commands/toggle.js';
import { uninstallCommand } from './commands/uninstall.js';
import { getShellInitScript, detectShell } from './commands/shell-init.js';

const program = new Command();
program
  .name('claude-profiles')
  .description('Profile switcher for Claude Code')
  .version('0.1.0');

program.addCommand(initCommand);
program.addCommand(createCommand);
program.addCommand(useCommand);
program.addCommand(listCommand);
program.addCommand(currentCommand);
program.addCommand(deleteCommand);
program.addCommand(toggleCommand);
program.addCommand(uninstallCommand);

program
  .command('shell-init')
  .description('Output shell hook (add to .zshrc/.bashrc)')
  .option('--shell <shell>', 'Shell type: bash, zsh, fish')
  .action((opts) => {
    console.log(getShellInitScript(opts.shell ?? detectShell()));
  });

program.parse();
```

- [ ] **Step 2: Create /profiles slash command**

```markdown
<!-- src/claude-commands/profiles.md -->
# /profiles — Manage Claude Code Profiles

Run profile management from within Claude Code by executing the corresponding CLI command.

## Commands

| Action | Command |
|--------|---------|
| List all profiles | `claude-profiles list` |
| Switch profile | `claude-profiles use <name>` |
| Show active profile | `claude-profiles current` |
| Create a profile | `claude-profiles create <name>` |
| Delete a profile | `claude-profiles delete <name>` |
| Toggle a plugin | `claude-profiles toggle plugin <name> on\|off` |

## Notes

- After switching profiles, **restart Claude Code** for changes to take effect
- The active profile shows in the statusline: `default | Opus 4.6 (1M context) | ...`
- Use `.claude-profile` files in project roots for automatic per-directory switching
- To edit a profile's config directly: open `~/.claude-profiles/profiles/<name>/settings.json`
- To edit MCP servers: open `~/.claude-profiles/profiles/<name>/mcp.json`
```

- [ ] **Step 3: Test CLI manually**

Run: `cd /Users/julianleopold/code/claude-profiles && npx tsx src/index.ts --help`
Expected: Help text with 9 commands

Run: `npx tsx src/index.ts shell-init`
Expected: Shell hook with sentinel comments

- [ ] **Step 4: Commit**

```bash
git add src/index.ts src/claude-commands/profiles.md
git commit -m "feat: wire all CLI commands and /profiles slash command"
```

---

## Task 10: End-to-End Test

**Files:**
- Create: `tests/e2e/workflow.test.ts`

- [ ] **Step 1: Write e2e test**

```typescript
// tests/e2e/workflow.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTestContext, type TestContext } from '../helpers/fixtures';
import { createProfile, listProfiles, deleteProfile } from '../../src/core/profile';
import { switchProfile } from '../../src/core/switcher';
import { loadState } from '../../src/core/state';
import { resolveProfile } from '../../src/core/resolver';
import { togglePlugin, getPluginToggles } from '../../src/core/toggle';
import { setupSharedResources, isSymlink } from '../../src/core/sharing';

describe('Full Workflow', () => {
  let ctx: TestContext;
  afterEach(async () => {
    delete process.env.CLAUDE_CONFIG_DIR;
    await ctx?.cleanup();
  });

  it('complete user journey', async () => {
    ctx = await createTestContext();

    // Init: create default from existing config
    await createProfile(ctx.baseDir, 'default', { fromDir: ctx.claudeDir });
    await setupSharedResources(ctx.baseDir, join(ctx.baseDir, 'profiles', 'default'), ctx.claudeDir, ['plugins', 'projects']);

    // Create ruflo profile
    await createProfile(ctx.baseDir, 'ruflo', { description: 'Ruflo setup' });
    await setupSharedResources(ctx.baseDir, join(ctx.baseDir, 'profiles', 'ruflo'), ctx.claudeDir, ['plugins', 'projects']);

    // Shared resources are symlinked
    expect(isSymlink(join(ctx.baseDir, 'profiles', 'ruflo', 'plugins'))).toBe(true);
    expect(isSymlink(join(ctx.baseDir, 'profiles', 'default', 'plugins'))).toBe(true);

    // Switch to ruflo
    await switchProfile(ctx.baseDir, 'ruflo');
    expect((await loadState(ctx.baseDir)).activeProfile).toBe('ruflo');

    // Toggle plugins differently per profile
    await togglePlugin(ctx.baseDir, 'default', 'superpowers', true);
    await togglePlugin(ctx.baseDir, 'ruflo', 'ruflo-plugin', true);
    expect((await getPluginToggles(ctx.baseDir, 'default'))['superpowers']).toBe(true);
    expect((await getPluginToggles(ctx.baseDir, 'ruflo'))['ruflo-plugin']).toBe(true);
    expect((await getPluginToggles(ctx.baseDir, 'ruflo'))['superpowers']).toBeUndefined();

    // Per-directory resolution
    await writeFile(join(ctx.projectDir, '.claude-profile'), 'ruflo');
    const resolved = await resolveProfile(ctx.baseDir, ctx.projectDir);
    expect(resolved.name).toBe('ruflo');
    expect(resolved.source).toBe('file');

    // List profiles — mark active by CLAUDE_CONFIG_DIR
    process.env.CLAUDE_CONFIG_DIR = join(ctx.baseDir, 'profiles', 'ruflo');
    const profiles = await listProfiles(ctx.baseDir);
    expect(profiles.find((p) => p.name === 'ruflo')?.isActive).toBe(true);
    expect(profiles.find((p) => p.name === 'default')?.isActive).toBe(false);

    // Switch back and delete ruflo
    await switchProfile(ctx.baseDir, 'default');
    delete process.env.CLAUDE_CONFIG_DIR;
    await deleteProfile(ctx.baseDir, 'ruflo');
    expect(await listProfiles(ctx.baseDir)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run full test suite**

Run: `cd /Users/julianleopold/code/claude-profiles && npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/
git commit -m "test: end-to-end workflow integration test"
```

---

## Task 11: Build, License & README

**Files:**
- Create: `LICENSE`
- Modify: `README.md`

- [ ] **Step 1: Verify build**

Run: `cd /Users/julianleopold/code/claude-profiles && npm run build && node dist/index.js --help`
Expected: Help text with all 9 commands

- [ ] **Step 2: Create MIT LICENSE file**

- [ ] **Step 3: Write README**

Structure (following viral patterns):
1. Badge wall: npm version, downloads, license, stars
2. One-line tagline: *"Swap Claude Code configurations in one command"*
3. Quick install: `npm i -g claude-profiles && claude-profiles init`
4. Comparison table: "Without profiles" vs "With profiles"
5. How it works: 3 steps (init → use → auto-switch)
6. All 9 commands with examples
7. Per-project auto-switching (`.claude-profile`)
8. How the statusline works: `default | Opus 4.6 (1M context) | ctx 9% | ...`
9. Uninstall: `claude-profiles uninstall`
10. Collapsible details: architecture, resolution chain, data layout

- [ ] **Step 4: Commit**

```bash
git add LICENSE README.md
git commit -m "docs: README, license"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Scaffolding | package.json, tsconfig, types, entry point |
| 2 | State & Profile CRUD | state.ts, profile.ts (validation, statusline, excluded dirs) |
| 3 | Resolver | pyenv-style resolution chain |
| 4 | Backup & Sharing | Safety backup, symlink management |
| 5 | Switcher | CLAUDE_CONFIG_DIR state management |
| 6 | Plugin Toggle | Enable/disable plugins per profile |
| 7 | Shell Hook | direnv-style auto-switch, auto-detect shell, sentinel comments |
| 8 | CLI Commands | init (auto-adds hook), create, use, list, current, delete, toggle, uninstall |
| 9 | Wire & Slash | Wire index.ts, /profiles slash command |
| 10 | E2E Test | Full workflow validation |
| 11 | Build & README | License, viral-ready docs |

**Total: 11 tasks, ~20 source files, ~12 test files, 9 CLI commands.**
