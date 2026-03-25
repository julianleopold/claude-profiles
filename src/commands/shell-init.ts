import { basename } from 'node:path';

export function detectShell(): string {
  const shell = process.env.SHELL ?? '';
  const name = basename(shell);
  if (name === 'fish') return 'fish';
  if (name === 'bash') return 'bash';
  return 'zsh';
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

/**
 * Shell hook for per-project auto-switching.
 * When you cd into a directory with a .claude-profile file,
 * it runs `claude-profiles use <name>` to swap config files.
 * This is OPTIONAL — basic profile switching works without the shell hook.
 */
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
    target_profile="$(tr -d '\r\n' < "$profile_file")"
    local current
    current="$(claude-profiles current 2>/dev/null)"

    if [ -n "$target_profile" ] && [ "$target_profile" != "$current" ]; then
      claude-profiles use "$target_profile" 2>/dev/null
      echo "[claude-profiles] Switched to: $target_profile (restart Claude Code to apply)"
    fi
  fi
}

${hookSetup}`;
}

function getFishHook(): string {
  return `function _claude_profiles_hook --on-variable PWD
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
    set -l current (claude-profiles current 2>/dev/null)

    if test -n "$target_profile"; and test "$target_profile" != "$current"
      claude-profiles use "$target_profile" 2>/dev/null
      echo "[claude-profiles] Switched to: $target_profile (restart Claude Code to apply)"
    end
  end
end`;
}
