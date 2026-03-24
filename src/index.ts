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
