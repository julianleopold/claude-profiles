#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();
program
  .name('claude-profiles')
  .description('Profile switcher for Claude Code')
  .version('0.1.0');
program.parse();
