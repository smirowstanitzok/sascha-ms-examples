// sandbox/execute.ts
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface SnippetResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  truncated: boolean;
  durationMs: number;
}

export interface ExecuteOptions {
  timeoutMs?: number;
  maxOutputBytes?: number;
}

// Runs a JavaScript snippet in a separate Node.js process.
// The security boundary is the MicroVM, this process only provides
// timeouts, output limits and a fresh working directory per run.
export async function executeSnippet(
  code: string,
  { timeoutMs = 5_000, maxOutputBytes = 32_768 }: ExecuteOptions = {},
): Promise<SnippetResult> {
  const workDir = await mkdtemp(join(tmpdir(), 'snippet-'));
  const file = join(workDir, 'main.mjs');
  await writeFile(file, code, 'utf8');

  const started = Date.now();
  const child = spawn(process.execPath, ['--max-old-space-size=256', file], {
    cwd: workDir,
    env: { PATH: '/usr/local/bin:/usr/bin:/bin' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  let truncated = false;
  const collect = (chunk: Buffer, target: 'out' | 'err') => {
    const used = Buffer.byteLength(stdout) + Buffer.byteLength(stderr);
    const room = maxOutputBytes - used;
    if (room <= 0) {
      truncated = true;
      return;
    }
    const text = chunk.subarray(0, room).toString('utf8');
    if (chunk.length > room) truncated = true;
    if (target === 'out') stdout += text;
    else stderr += text;
  };
  child.stdout.on('data', (c: Buffer) => collect(c, 'out'));
  child.stderr.on('data', (c: Buffer) => collect(c, 'err'));

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill('SIGKILL');
  }, timeoutMs);

  const exitCode = await new Promise<number | null>((resolve) => {
    child.on('close', (code) => resolve(code));
  });
  clearTimeout(timer);
  await rm(workDir, { recursive: true, force: true });

  return { exitCode, stdout, stderr, timedOut, truncated, durationMs: Date.now() - started };
}
