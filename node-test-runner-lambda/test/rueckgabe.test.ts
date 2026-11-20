// test/rueckgabe.test.ts
import { describe, it, beforeEach, afterEach, mock, type Mock } from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import type { Ausleihe, AusleihenRepository } from '../src/ausleihen.ts';
import { erstelleRueckgabeHandler } from '../src/rueckgabe.ts';

// Minimal API Gateway event – only the fields the handler reads.
const event = (ausleiheId?: string) =>
  ({ pathParameters: ausleiheId ? { ausleiheId } : undefined }) as unknown as APIGatewayProxyEventV2;

const offeneAusleihe: Ausleihe = {
  ausleiheId: 'a-42',
  radId: 'rad-7',
  startAm: '2026-05-02T09:00:00.000Z',
};

describe('return handler', () => {
  let laden: Mock<AusleihenRepository['laden']>;
  let abschliessen: Mock<AusleihenRepository['abschliessen']>;
  let repo: AusleihenRepository;

  beforeEach(() => {
    // Fixed time: 2 hours 15 minutes after the start
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-05-02T11:15:00.000Z') });
    laden = mock.fn<AusleihenRepository['laden']>(async () => structuredClone(offeneAusleihe));
    abschliessen = mock.fn<AusleihenRepository['abschliessen']>(async () => {});
    repo = { laden, abschliessen };
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('closes an open rental and charges three hours', async () => {
    const handler = erstelleRueckgabeHandler(repo);

    const res = (await handler(event('a-42'))) as APIGatewayProxyStructuredResultV2;

    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(String(res.body)), {
      ausleiheId: 'a-42',
      radId: 'rad-7',
      zurueckAm: '2026-05-02T11:15:00.000Z',
      gebuehrCent: 900,
    });

    assert.equal(abschliessen.mock.callCount(), 1);
    assert.deepEqual(abschliessen.mock.calls[0].arguments, ['a-42', '2026-05-02T11:15:00.000Z', 900]);
  });

  it('responds with 404 when the rental does not exist', async () => {
    laden.mock.mockImplementationOnce(async () => undefined);
    const handler = erstelleRueckgabeHandler(repo);

    const res = (await handler(event('does-not-exist'))) as APIGatewayProxyStructuredResultV2;

    assert.equal(res.statusCode, 404);
    assert.equal(abschliessen.mock.callCount(), 0);
  });

  it('responds with 409 when the bike was already returned', async () => {
    laden.mock.mockImplementationOnce(async () => ({
      ...offeneAusleihe,
      zurueckAm: '2026-05-02T10:00:00.000Z',
    }));
    const handler = erstelleRueckgabeHandler(repo);

    const res = (await handler(event('a-42'))) as APIGatewayProxyStructuredResultV2;

    assert.equal(res.statusCode, 409);
  });

  it('responds with 400 without a path parameter', async () => {
    const handler = erstelleRueckgabeHandler(repo);

    const res = (await handler(event())) as APIGatewayProxyStructuredResultV2;

    assert.equal(res.statusCode, 400);
  });

  it('passes database errors on', async () => {
    // mock.method replaces a method on an existing object
    mock.method(repo, 'abschliessen', async () => {
      throw new Error('ConditionalCheckFailed');
    });
    const handler = erstelleRueckgabeHandler(repo);

    await assert.rejects(handler(event('a-42')), /ConditionalCheckFailed/);
  });

  it('returns a stable response shape', async (t) => {
    const handler = erstelleRueckgabeHandler(repo);

    const res = (await handler(event('a-42'))) as APIGatewayProxyStructuredResultV2;

    t.assert.snapshot(JSON.parse(String(res.body)));
  });
});
