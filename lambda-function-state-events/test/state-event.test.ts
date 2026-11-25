// test/state-event.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildMessage,
  classify,
  dedupeKey,
  parseFunctionArn,
  type FunctionStateEvent,
} from '../src/state-event.ts';

const base: FunctionStateEvent = {
  id: 'e-1',
  'detail-type': 'Event Function Version Update Failed',
  source: 'aws.lambda',
  time: '2026-11-25T08:15:00Z',
  region: 'eu-central-1',
  resources: ['arn:aws:lambda:eu-central-1:111122223333:function:radwerk-rentals:$LATEST'],
  detail: {
    action: 'UpdateFunctionConfiguration',
    state: 'Active',
    lastUpdateStatus: 'Failed',
    lastUpdateStatusReasonCode: 'SubnetOutOfIPAddresses',
    revisionId: 'rev-42',
  },
};

test('parseFunctionArn reads name and version', () => {
  assert.deepEqual(parseFunctionArn('arn:aws:lambda:eu-central-1:1:function:radwerk-returns:3'), {
    name: 'radwerk-returns',
    qualifier: '3',
  });
  assert.equal(parseFunctionArn('arn:aws:lambda:eu-central-1:1:function:radwerk-returns').qualifier, undefined);
});

test('parseFunctionArn rejects other ARNs', () => {
  assert.throws(() => parseFunctionArn('arn:aws:sqs:eu-central-1:1:queue'), /Not a Lambda function ARN/);
});

test('failed updates are errors', () => {
  assert.equal(classify(base), 'error');
  assert.equal(classify({ ...base, 'detail-type': 'Event Function Version Activation Failed' }), 'error');
});

test('only published versions create an info', () => {
  const activated = { ...base, 'detail-type': 'Event Function Version Activated' };
  assert.equal(classify({ ...activated, detail: { action: 'PublishVersion' } }), 'info');
  assert.equal(classify({ ...activated, detail: { action: 'CreateFunction' } }), 'ignore');
  assert.equal(classify({ ...base, 'detail-type': 'Event Function Version Updated' }), 'ignore');
});

test('dedupeKey uses revisionId and falls back to the event ID', () => {
  assert.equal(dedupeKey(base), 'Event Function Version Update Failed#rev-42');
  assert.equal(dedupeKey({ ...base, detail: {} }), 'Event Function Version Update Failed#e-1');
});

test('error message contains reason code and current status', () => {
  const { subject, body } = buildMessage(base, 'State=Active, LastUpdateStatus=Successful');
  assert.equal(subject, 'Deployment failed: radwerk-rentals');
  assert.match(body, /SubnetOutOfIPAddresses/);
  assert.match(body, /Status according to GetFunction: State=Active, LastUpdateStatus=Successful/);
});

test('subject stays within the SNS limit of 100 characters', () => {
  const long = { ...base, resources: [`arn:aws:lambda:eu-central-1:1:function:${'x'.repeat(64)}:1`] };
  assert.ok(buildMessage(long).subject.length <= 100);
});
