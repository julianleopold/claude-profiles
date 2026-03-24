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
