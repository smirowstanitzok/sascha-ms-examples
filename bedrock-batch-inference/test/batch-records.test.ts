// test/batch-records.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jobIdFromArn, parseOutputLine, runNameForDate, toBatchRecord, toJsonl } from '../src/batch-records.js';

const review = { reviewId: 'r-001', bookTitle: 'The Quiet Lighthouse', text: 'Great characters, but the ending drags on.' };

test('builds a record in Converse format', () => {
  const record = JSON.parse(toBatchRecord(review));
  assert.equal(record.recordId, 'r-001');
  assert.equal(record.modelInput.messages[0].role, 'user');
  assert.match(record.modelInput.messages[0].content[0].text, /The Quiet Lighthouse/);
  assert.equal(record.modelInput.inferenceConfig.temperature, 0);
});

test('JSONL has one line per review', () => {
  const jsonl = toJsonl([review, { ...review, reviewId: 'r-002' }]);
  assert.equal(jsonl.trim().split('\n').length, 2);
});

test('reads a successful output line', () => {
  const line = JSON.stringify({
    recordId: 'r-001',
    modelOutput: {
      output: { message: { role: 'assistant', content: [{ text: '```json\n{"sentiment":"positive","topics":["characters","plot","weather"],"summary":"Strong characters, long ending."}\n```' }] } },
    },
  });
  const result = parseOutputLine(line);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.classification.sentiment, 'positive');
    assert.deepEqual(result.classification.topics, ['characters', 'plot']);
  }
});

test('reports error lines and broken responses', () => {
  const errorLine = JSON.stringify({ recordId: 'r-002', error: { errorCode: 400, errorMessage: 'bad request' } });
  assert.deepEqual(parseOutputLine(errorLine), { recordId: 'r-002', ok: false, reason: '400: bad request' });

  const brokenLine = JSON.stringify({ recordId: 'r-003', modelOutput: { output: { message: { content: [{ text: 'No idea' }] } } } });
  const broken = parseOutputLine(brokenLine);
  assert.equal(broken.ok, false);
});

test('helpers for names and ARNs', () => {
  assert.equal(runNameForDate(new Date('2026-11-17T23:10:00Z')), 'reviews-2026-11-17');
  assert.equal(jobIdFromArn('arn:aws:bedrock:eu-central-1:123456789012:model-invocation-job/abc123xyz'), 'abc123xyz');
});
