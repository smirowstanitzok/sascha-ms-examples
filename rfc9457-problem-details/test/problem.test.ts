// test/problem.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { createReserveHandler } from '../src/handler.ts';
import { PROBLEM_TYPES, toProblem, typeUri } from '../src/problem.ts';
import { describeFailure } from '../src/client.ts';
import { problemDocs } from '../src/docs.ts';
import { notFound } from '../src/not-found.ts';
import type { BikeRepository } from '../src/reservation.ts';

const repoWith = (overrides: Partial<BikeRepository> = {}): BikeRepository => ({
  findBike: async (id) => ({ id }),
  countActiveReservations: async () => 0,
  saveReservation: async () => {},
  ...overrides,
});
const context = { awsRequestId: '0f8e6b9a-1c2d-4e5f-8a7b-123456789abc' } as Context;
const post = (body: unknown) => ({ body: typeof body === 'string' ? body : JSON.stringify(body) }) as APIGatewayProxyEventV2;
const valid = { bikeId: 'bike-2', customerId: 'customer-7', from: '2027-05-01T09:00:00Z', to: '2027-05-01T18:00:00Z' };

test('booked bike becomes 409 with application/problem+json', async () => {
  const repo = repoWith({ findBike: async (id) => ({ id, reservedUntil: '2030-01-01T00:00:00Z' }) });
  const res = await createReserveHandler(repo)(post(valid), context);
  assert.equal(res.statusCode, 409);
  assert.equal(res.headers['content-type'], 'application/problem+json');
  const problem = JSON.parse(res.body);
  assert.equal(problem.type, typeUri('BikeUnavailable'));
  assert.equal(problem.status, res.statusCode);
  assert.equal(problem.freeFrom, '2030-01-01T00:00:00Z');
  assert.equal(problem.instance, 'urn:uuid:0f8e6b9a-1c2d-4e5f-8a7b-123456789abc');
});

test('multiple invalid fields end up together in errors', async () => {
  const res = await createReserveHandler(repoWith())(post({ bikeId: 'bike-1', from: 'morgen' }), context);
  const problem = JSON.parse(res.body);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(
    problem.errors.map((e: { pointer: string }) => e.pointer),
    ['#/customerId', '#/from', '#/to'],
  );
});

test('broken JSON results in 400 instead of 500', async () => {
  const res = await createReserveHandler(repoWith())(post('{"bikeId":'), context);
  assert.equal(res.statusCode, 400);
});

test('failure becomes 500 without internal details', async (t) => {
  t.mock.method(console, 'error', () => {});
  const broken = repoWith({ saveReservation: async () => { throw new Error('table reservations unreachable'); } });
  const res = await createReserveHandler(broken)(post(valid), context);
  assert.equal(res.statusCode, 500);
  const problem = JSON.parse(res.body);
  assert.equal(problem.type, 'about:blank');
  assert.doesNotMatch(res.body, /table|stack/i);
});

test('every error kind has a unique type URI', () => {
  const slugs = Object.values(PROBLEM_TYPES).map((t) => t.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test('client detects the problem type via type', async () => {
  const problem = toProblem({ kind: 'BikeUnavailable', bikeId: 'bike-2', freeFrom: '2030-01-01T00:00:00Z' });
  const res = new Response(JSON.stringify(problem), {
    status: 409,
    headers: { 'content-type': 'application/problem+json' },
  });
  assert.equal(await describeFailure(res), 'Sorry, already booked. Free from 2030-01-01T00:00:00Z.');
});

test('type URI serves an HTML doc', async () => {
  const res = await problemDocs({ pathParameters: { slug: 'bike-unavailable' } } as unknown as APIGatewayProxyEventV2);
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /freeFrom/);
});

test('unknown route returns 404 as a problem', async () => {
  const event = { rawPath: '/bikes', requestContext: { http: { method: 'GET' } } } as unknown as APIGatewayProxyEventV2;
  const res = await notFound(event);
  assert.equal(res.statusCode, 404);
  assert.equal(JSON.parse(res.body).title, 'Not Found');
});
