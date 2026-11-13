// test/heartbeat.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runWithHeartbeat, TaskGoneError } from '../src/heartbeat.js';

function namedError(name: string): Error {
  const err = new Error(name);
  err.name = name;
  return err;
}

describe('runWithHeartbeat', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sends a heartbeat immediately and then at the interval', async () => {
    const send = vi.fn().mockResolvedValue({});
    const work = (signal: AbortSignal) =>
      new Promise<string>((resolve) => setTimeout(() => resolve(signal.aborted ? 'aborted' : 'done'), 65_000));

    const result = runWithHeartbeat(work, { taskToken: 't-1', intervalMs: 20_000, client: { send } });
    await vi.advanceTimersByTimeAsync(65_000);

    await expect(result).resolves.toBe('done');
    expect(send).toHaveBeenCalledTimes(4); // immediately + after 20, 40 and 60 seconds
  });

  it('does not start at all if the task has already expired', async () => {
    const send = vi.fn().mockRejectedValue(namedError('TaskTimedOut'));
    const work = vi.fn();

    await expect(runWithHeartbeat(work, { taskToken: 't-2', intervalMs: 20_000, client: { send } })).rejects.toBeInstanceOf(
      TaskGoneError,
    );
    expect(work).not.toHaveBeenCalled();
  });

  it('aborts the work as soon as Step Functions no longer knows the task', async () => {
    const send = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(namedError('TaskTimedOut'));
    const work = (signal: AbortSignal) =>
      new Promise<string>((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));

    const result = runWithHeartbeat(work, { taskToken: 't-3', intervalMs: 20_000, client: { send } });
    const assertion = expect(result).rejects.toThrow(/no longer waiting/);
    await vi.advanceTimersByTimeAsync(20_000);
    await assertion;
  });

  it('survives individual network errors during heartbeats', async () => {
    const send = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(namedError('ECONNRESET')).mockResolvedValue({});
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const work = () => new Promise<string>((resolve) => setTimeout(() => resolve('done'), 45_000));

    const result = runWithHeartbeat(work, { taskToken: 't-4', intervalMs: 20_000, client: { send } });
    await vi.advanceTimersByTimeAsync(45_000);
    await expect(result).resolves.toBe('done');
  });
});
