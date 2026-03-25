export interface State {
  /** Currently active profile name */
  activeProfile: string;
  /** List of all profile names (always includes "default") */
  profiles: string[];
  version: string;
}

export interface ProfileConfig {
  name: string;
  description?: string;
  createdAt: string;
}

export interface ProfileInfo {
  name: string;
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

export interface ResolvedProfile {
  name: string;
  source: 'env' | 'file' | 'default';
  filePath?: string;
}

/** Valid profile names: lowercase alphanumeric, hyphens, underscores, 1-63 chars */
export const PROFILE_NAME_REGEX = /^[a-z0-9][a-z0-9_-]{0,62}$/;

/** Config files that get swapped between profiles */
export const CONFIG_FILES = ['settings.json', 'settings.local.json', 'mcp.json', 'CLAUDE.md'];

/** Config directories that get swapped between profiles */
export const CONFIG_DIRS = ['commands', 'hooks'];
