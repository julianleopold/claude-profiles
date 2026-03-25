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

  it('hook reads .claude-profile and calls claude-profiles use', () => {
    const script = getShellInitScript('zsh');
    expect(script).toContain('.claude-profile');
    expect(script).toContain('claude-profiles use');
    expect(script).toContain('claude-profiles current');
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
