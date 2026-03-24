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
