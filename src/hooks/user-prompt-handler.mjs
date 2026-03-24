#!/usr/bin/env node
/**
 * UserPromptSubmit hook for claude-profiles.
 *
 * Intercepts prompts matching /profiles commands, executes the CLI,
 * and injects the output as additionalContext so Claude doesn't need
 * to figure out what to run.
 *
 * Input (stdin): { "prompt": "...", "session_id": "...", "cwd": "..." }
 * Output (stdout): { "hookSpecificOutput": { "hookEventName": "UserPromptSubmit", "additionalContext": "..." } }
 */

import { execSync } from 'node:child_process';

function main() {
  let input;
  try {
    const raw = require('fs').readFileSync('/dev/stdin', 'utf-8').trim();
    if (!raw) { emitEmpty(); return; }
    input = JSON.parse(raw);
  } catch {
    emitEmpty();
    return;
  }

  const prompt = (input.prompt || '').trim();

  // Match /profiles commands (slash command or natural language)
  const match = prompt.match(/^\/?profiles[-\s]*(list|use|create|current|delete|toggle|)\s*(.*)?$/i);
  if (!match) {
    emitEmpty();
    return;
  }

  const subcommand = (match[1] || 'list').toLowerCase();
  const args = (match[2] || '').trim();

  let cliCommand;
  let context;

  try {
    switch (subcommand) {
      case 'list':
      case '':
        cliCommand = 'claude-profiles list';
        const listOutput = exec(cliCommand);
        context = `[claude-profiles] Current profiles:\n\n${listOutput}\n\nShow this output to the user. Mention they can use /profiles-create to add profiles or /profiles-use to switch.`;
        break;

      case 'current':
        cliCommand = 'claude-profiles current';
        const currentOutput = exec(cliCommand);
        context = `[claude-profiles] Active profile: ${currentOutput.trim()}\n\nShow this to the user.`;
        break;

      case 'use':
        if (!args) {
          // No profile name provided — list profiles so Claude can ask which one
          const profiles = exec('claude-profiles list');
          context = `[claude-profiles] The user wants to switch profiles but didn't specify which one.\n\nAvailable profiles:\n${profiles}\n\nAsk the user which profile to switch to, then run: \`claude-profiles use <name>\``;
          break;
        }
        cliCommand = `claude-profiles use ${shellEscape(args)}`;
        const useOutput = exec(cliCommand);
        context = `[claude-profiles] ${useOutput}\n\nShow this output to the user.`;
        break;

      case 'create':
        if (!args) {
          context = `[claude-profiles] The user wants to create a profile. Ask them for:\n1. Profile name (lowercase, hyphens, underscores)\n2. Description (optional)\n\nThen run: \`claude-profiles create <name> -d "<description>"\``;
          break;
        }
        // Parse "name - description" or just "name"
        const createMatch = args.match(/^(\S+)\s*[-—]\s*(.+)$/);
        if (createMatch) {
          cliCommand = `claude-profiles create ${shellEscape(createMatch[1])} -d ${shellEscape(createMatch[2])}`;
        } else {
          cliCommand = `claude-profiles create ${shellEscape(args.split(/\s/)[0])}`;
        }
        const createOutput = exec(cliCommand);
        context = `[claude-profiles] ${createOutput}\n\nShow this output to the user.`;
        break;

      case 'delete':
        if (!args) {
          const profilesForDelete = exec('claude-profiles list');
          context = `[claude-profiles] The user wants to delete a profile.\n\nAvailable profiles:\n${profilesForDelete}\n\nAsk which profile to delete, then run: \`claude-profiles delete <name> --force\``;
          break;
        }
        cliCommand = `claude-profiles delete ${shellEscape(args.split(/\s/)[0])} --force`;
        const deleteOutput = exec(cliCommand);
        context = `[claude-profiles] ${deleteOutput}\n\nShow this output to the user.`;
        break;

      case 'toggle':
        if (!args) {
          context = `[claude-profiles] The user wants to toggle a plugin. Ask them for:\n1. Plugin name\n2. on or off\n\nThen run: \`claude-profiles toggle plugin <name> on|off\``;
          break;
        }
        // Parse "plugin-name on/off" or "plugin plugin-name on/off"
        const toggleMatch = args.match(/(?:plugin\s+)?(\S+)\s+(on|off)/i);
        if (toggleMatch) {
          cliCommand = `claude-profiles toggle plugin ${shellEscape(toggleMatch[1])} ${toggleMatch[2]}`;
          const toggleOutput = exec(cliCommand);
          context = `[claude-profiles] ${toggleOutput}\n\nShow this output to the user.`;
        } else {
          context = `[claude-profiles] Could not parse toggle command. Usage: \`claude-profiles toggle plugin <name> on|off\`\n\nAsk the user for the plugin name and whether to enable or disable it.`;
        }
        break;

      default:
        emitEmpty();
        return;
    }
  } catch (err) {
    context = `[claude-profiles] Error running command: ${err.message}\n\nShow this error to the user.`;
  }

  if (context) {
    emit(context);
  } else {
    emitEmpty();
  }
}

function exec(cmd) {
  return execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim();
}

function shellEscape(str) {
  return `'${str.replace(/'/g, "'\\''")}'`;
}

function emit(additionalContext) {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext,
    },
  };
  process.stdout.write(JSON.stringify(output));
}

function emitEmpty() {
  process.stdout.write('{}');
}

main();
