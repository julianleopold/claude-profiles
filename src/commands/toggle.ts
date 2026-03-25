import { Command } from 'commander';
import { togglePlugin } from '../core/toggle.js';

export async function toggleAction(pluginName: string, enabled: boolean): Promise<void> {
  await togglePlugin(pluginName, enabled);
}

export const toggleCommand = new Command('toggle');

toggleCommand
  .command('plugin')
  .argument('<name>', 'Plugin name')
  .argument('<state>', '"on" or "off"')
  .description('Enable/disable a plugin in the active profile')
  .action(async (name: string, state: string) => {
    if (state !== 'on' && state !== 'off') {
      console.error(`Invalid state "${state}". Use "on" or "off".`);
      process.exit(1);
    }
    const enabled = state === 'on';
    await toggleAction(name, enabled);
    console.log(`Plugin "${name}" ${enabled ? 'enabled' : 'disabled'}`);
    console.log('Restart Claude Code for changes to take effect.');
  });
