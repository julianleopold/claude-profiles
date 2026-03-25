/**
 * Installs the UserPromptSubmit hook into a Claude Code settings.json.
 * The hook intercepts /profiles commands and runs them via the CLI,
 * injecting the output as context so Claude responds in ~1s instead of ~10s.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

interface HookEntry {
  type: string;
  command: string;
  timeout?: number;
}

interface HookMatcher {
  matcher?: string;
  hooks: HookEntry[];
}

interface Settings {
  hooks?: Record<string, HookMatcher[]>;
  permissions?: { allow?: string[]; deny?: string[] };
  [key: string]: unknown;
}

const HOOK_MARKER = 'claude-profiles-hook';

/** The handler script content — inlined to avoid path resolution issues */
const HANDLER_SCRIPT = `#!/usr/bin/env node
/**
 * claude-profiles UserPromptSubmit hook handler.
 * Intercepts /profiles commands, runs the CLI, injects output as context.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function main() {
  let input;
  try {
    const raw = readFileSync('/dev/stdin', 'utf-8').trim();
    if (!raw) { emitEmpty(); return; }
    input = JSON.parse(raw);
  } catch { emitEmpty(); return; }

  const prompt = (input.prompt || '').trim();
  const match = prompt.match(/^\\/?profiles[-\\s]*(list|use|create|current|delete|toggle|)\\s*(.*)?$/i);
  if (!match) { emitEmpty(); return; }

  const sub = (match[1] || 'list').toLowerCase();
  const args = (match[2] || '').trim();
  let ctx;

  try {
    switch (sub) {
      case 'list': case '':
        ctx = \`[claude-profiles] Current profiles:\\n\\n\${exec('claude-profiles list')}\\n\\nShow this to the user.\`;
        break;
      case 'current':
        ctx = \`[claude-profiles] Active profile: \${exec('claude-profiles current')}\\n\\nShow this to the user.\`;
        break;
      case 'use':
        if (!args) {
          ctx = \`[claude-profiles] Available profiles:\\n\${exec('claude-profiles list')}\\n\\nAsk which profile to switch to, then run: claude-profiles use <name>\`;
        } else if (!validName(args.split(/\\s/)[0])) {
          ctx = '[claude-profiles] Invalid profile name. Use lowercase alphanumeric, hyphens, underscores (1-63 chars).';
        } else {
          ctx = \`[claude-profiles] \${exec('claude-profiles use ' + esc(args))}\\n\\nShow this to the user.\`;
        }
        break;
      case 'create':
        if (!args) {
          ctx = '[claude-profiles] Ask for: 1) Profile name 2) Description (optional). Then run: claude-profiles create <name> -d "<desc>"';
        } else {
          const cName = args.split(/\\s/)[0];
          if (!validName(cName)) { ctx = '[claude-profiles] Invalid profile name. Use lowercase alphanumeric, hyphens, underscores (1-63 chars).'; break; }
          const m = args.match(/^(\\S+)\\s*[-—]\\s*(.+)$/);
          const cmd = m ? 'claude-profiles create ' + esc(m[1]) + ' -d ' + esc(m[2]) : 'claude-profiles create ' + esc(cName);
          ctx = \`[claude-profiles] \${exec(cmd)}\\n\\nShow this to the user.\`;
        }
        break;
      case 'delete':
        if (!args) {
          ctx = \`[claude-profiles] Available profiles:\\n\${exec('claude-profiles list')}\\n\\nAsk which to delete, then run: claude-profiles delete <name> --force\`;
        } else {
          const dName = args.split(/\\s/)[0];
          if (!validName(dName)) { ctx = '[claude-profiles] Invalid profile name.'; break; }
          ctx = \`[claude-profiles] \${exec('claude-profiles delete ' + esc(dName) + ' --force')}\\n\\nShow this to the user.\`;
        }
        break;
      case 'toggle': {
        const tm = args.match(/(?:plugin\\s+)?(\\S+)\\s+(on|off)/i);
        if (tm) {
          ctx = \`[claude-profiles] \${exec('claude-profiles toggle plugin ' + esc(tm[1]) + ' ' + tm[2])}\\n\\nShow this to the user.\`;
        } else {
          ctx = '[claude-profiles] Usage: claude-profiles toggle plugin <name> on|off. Ask the user for details.';
        }
        break;
      }
      default: emitEmpty(); return;
    }
  } catch (e) { ctx = '[claude-profiles] Error: ' + e.message; }

  emit(ctx);
}

function exec(cmd) { return execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim(); }
function esc(s) { return "'" + s.replace(/'/g, "'\\\\''") + "'"; }
function validName(s) { return /^[a-z0-9][a-z0-9_-]{0,62}$/.test(s); }
function emit(additionalContext) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext } }));
}
function emitEmpty() { process.stdout.write('{}'); }
main();
`;

export async function installHooks(configDir: string): Promise<boolean> {
  const settingsPath = join(configDir, 'settings.json');

  let settings: Settings = {};
  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(await readFile(settingsPath, 'utf-8'));
    } catch {
      return false;
    }
  }

  // Check if already installed
  if (settings.hooks?.UserPromptSubmit) {
    const existing = settings.hooks.UserPromptSubmit;
    if (existing.some((h) => h.hooks?.some((hh) => hh.command?.includes(HOOK_MARKER)))) {
      return false;
    }
  }

  // Write the handler script to the config directory
  const handlersDir = join(configDir, 'hooks');
  await mkdir(handlersDir, { recursive: true });
  const handlerDest = join(handlersDir, 'claude-profiles-hook.mjs');
  await writeFile(handlerDest, HANDLER_SCRIPT);

  // Add the hook to settings.json
  settings.hooks = settings.hooks ?? {};
  settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit ?? [];

  settings.hooks.UserPromptSubmit.push({
    matcher: '(?i)^\\/?profiles',
    hooks: [
      {
        type: 'command',
        command: `node "${handlerDest}" # ${HOOK_MARKER}`,
        timeout: 5000,
      },
    ],
  });

  // Add auto-approve permissions for claude-profiles commands
  settings.permissions = settings.permissions ?? {};
  settings.permissions.allow = settings.permissions.allow ?? [];
  const profilePerms = [
    'Bash(claude-profiles *)',
    'Bash(claude-profiles)',
  ];
  for (const perm of profilePerms) {
    if (!settings.permissions.allow.includes(perm)) {
      settings.permissions.allow.push(perm);
    }
  }

  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  return true;
}

export async function uninstallHooks(configDir: string): Promise<boolean> {
  const settingsPath = join(configDir, 'settings.json');
  if (!existsSync(settingsPath)) return false;

  let settings: Settings;
  try {
    settings = JSON.parse(await readFile(settingsPath, 'utf-8'));
  } catch {
    return false;
  }

  if (!settings.hooks?.UserPromptSubmit) return false;

  const before = settings.hooks.UserPromptSubmit.length;
  settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit.filter(
    (h) => !h.hooks?.some((hh) => hh.command?.includes(HOOK_MARKER)),
  );

  if (settings.hooks.UserPromptSubmit.length === 0) {
    delete settings.hooks.UserPromptSubmit;
  }
  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  // Remove auto-approve permissions
  if (settings.permissions?.allow) {
    settings.permissions.allow = settings.permissions.allow.filter(
      (p) => !p.startsWith('Bash(claude-profiles'),
    );
    if (settings.permissions.allow.length === 0) delete settings.permissions.allow;
    if (Object.keys(settings.permissions ?? {}).length === 0) delete settings.permissions;
  }

  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  return true;
}
