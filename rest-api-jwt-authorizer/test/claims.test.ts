// test/claims.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { callerOf, readClaims, scopesOf } from '../src/claims';
import { handler as createRental } from '../src/create-rental';

const eventWith = (claims: unknown, body?: string) =>
  ({ requestContext: { authorizer: { claims } }, body: body ?? null }) as unknown as APIGatewayProxyEvent;

test('claims keep their JSON type', () => {
  const claims = readClaims(eventWith({ iat: 1763452800, roles: ['cashier', 'workshop'] }));
  assert.equal(typeof claims.iat, 'number');
  assert.deepEqual(claims.roles, ['cashier', 'workshop']);
});

test('reads scopes from scope (text) and scp (list)', () => {
  assert.deepEqual(scopesOf({ scope: 'bike-rental/bikes:read bike-rental/rentals:write' }), [
    'bike-rental/bikes:read',
    'bike-rental/rentals:write',
  ]);
  assert.deepEqual(scopesOf({ scp: ['bikes:read'] }), ['bikes:read']);
  assert.deepEqual(scopesOf({}), []);
});

test('caller: client_id before sub', () => {
  assert.equal(callerOf({ client_id: 'booking-app', sub: 'x' }), 'booking-app');
  assert.equal(callerOf({ sub: 'user-7' }), 'user-7');
  assert.equal(callerOf({}), 'unknown');
});

test('missing claims raise a clear error', () => {
  assert.throws(() => readClaims(eventWith(undefined)), /JWT authorizer/);
});

test('create rental: 201 with a valid scope', async () => {
  const res = await createRental(
    eventWith({ client_id: 'booking-app', scope: 'bike-rental/rentals:write' }, '{"bikeId":"bike-201"}'),
  );
  assert.equal(res.statusCode, 201);
  assert.equal(JSON.parse(res.body).bookedBy, 'booking-app');
});

test('create rental: 403 without write scope, 400 without bikeId', async () => {
  const readOnly = await createRental(eventWith({ scope: 'bike-rental/bikes:read' }, '{"bikeId":"bike-201"}'));
  assert.equal(readOnly.statusCode, 403);
  const empty = await createRental(eventWith({ scope: 'rentals:write' }, '{}'));
  assert.equal(empty.statusCode, 400);
});
