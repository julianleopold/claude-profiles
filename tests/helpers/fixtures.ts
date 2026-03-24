import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface TestContext {
  baseDir: string;
  claudeDir: string;
  projectDir: string;
  cleanup: () => Promise<void>;
}

export async function createTestContext(): Promise<TestContext> {
  const baseDir = await mkdtemp(join(tmpdir(), 'cp-test-'));
  const claudeDir = await mkdtemp(join(tmpdir(), 'cp-claude-'));
  const projectDir = await mkdtemp(join(tmpdir(), 'cp-project-'));

  await writeFile(join(claudeDir, 'settings.json'), JSON.stringify({
    model: 'claude-sonnet-4-6',
    statusLine: { type: 'command', command: 'bash ~/.claude/statusline.sh' },
  }, null, 2));
  await writeFile(join(claudeDir, 'CLAUDE.md'), '# My Instructions\n');
  await mkdir(join(claudeDir, 'plugins', 'cache'), { recursive: true });
  await mkdir(join(claudeDir, 'projects'), { recursive: true });

  return {
    baseDir, claudeDir, projectDir,
    cleanup: async () => {
      await rm(baseDir, { recursive: true, force: true });
      await rm(claudeDir, { recursive: true, force: true });
      await rm(projectDir, { recursive: true, force: true });
    },
  };
}
