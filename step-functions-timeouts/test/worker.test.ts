// test/worker.test.ts
import { setTimeout as sleep } from 'node:timers/promises';
import { describe, expect, it, vi } from 'vitest';
import { BikeOfflineError } from '../src/battery-diagnosis.js';
import { processCheck, type WorkerDeps } from '../src/battery-check-worker.js';

const request = { taskToken: 't-1', rentalId: 'R-42', bikeId: 'ebike-7' };

function deps(overrides: Partial<WorkerDeps>): WorkerDeps {
  return {
    client: { send: vi.fn().mockResolvedValue({}) },
    diagnose: vi.fn().mockResolvedValue({ bikeId: 'ebike-7', healthPercent: 88, chargeCycles: 300, verdict: 'ok' }),
    heartbeatIntervalMs: 20_000,
    budgetMs: 60_000,
    ...overrides,
  };
}

function sentCommands(d: WorkerDeps): string[] {
  return (d.client.send as ReturnType<typeof vi.fn>).mock.calls.map(([cmd]) => cmd.constructor.name);
}

describe('processCheck', () => {
  it('reports the result with SendTaskSuccess', async () => {
    const d = deps({});
    await expect(processCheck(request, d)).resolves.toBe('success');
    expect(sentCommands(d)).toEqual(['SendTaskHeartbeatCommand', 'SendTaskSuccessCommand']);
  });

  it('reports an unreachable bike as BatteryCheck.BikeOffline', async () => {
    const d = deps({ diagnose: vi.fn().mockRejectedValue(new BikeOfflineError('ebike-7')) });
    await expect(processCheck(request, d)).resolves.toBe('failure');
    const last = (d.client.send as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
    expect(last.input.error).toBe('BatteryCheck.BikeOffline');
  });

  it('reports an exceeded time budget as BatteryCheck.TooSlow', async () => {
    const d = deps({
      budgetMs: 5,
      // sleep() from timers/promises throws an AbortError with the reason in cause when aborted
      diagnose: async (bikeId, signal) => {
        await sleep(60_000, undefined, { signal });
        return { bikeId, healthPercent: 90, chargeCycles: 10, verdict: 'ok' };
      },
    });
    await expect(processCheck(request, d)).resolves.toBe('failure');
    const last = (d.client.send as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
    expect(last.input.error).toBe('BatteryCheck.TooSlow');
  });

  it('reports nothing if the task has already expired', async () => {
    const gone = Object.assign(new Error('expired'), { name: 'TaskTimedOut' });
    const d = deps({ client: { send: vi.fn().mockRejectedValue(gone) } });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(processCheck(request, d)).resolves.toBe('gone');
    expect(d.diagnose).not.toHaveBeenCalled();
  });
});
