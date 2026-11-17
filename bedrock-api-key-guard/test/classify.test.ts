// test/classify.test.ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { classify, parseAllowList, principalOf } from '../src/classify.js';
import { createHandler } from '../src/handler.js';

const load = (name: string) => JSON.parse(readFileSync(`events/${name}.json`, 'utf8'));
const bearer = load('bearer-token');
const created = load('create-credential');

describe('classify', () => {
  it('reports a new key with a long lifetime as HIGH', () => {
    const finding = classify(created.detail, []);
    expect(finding?.kind).toBe('KEY_CREATED');
    expect(finding?.severity).toBe('HIGH');
    expect(finding?.subject).toMatch(/New Bedrock API key for BedrockAPIKey-x7k2/);
  });

  it('rates a key with a 30-day lifetime as MEDIUM', () => {
    const detail = { ...created.detail, requestParameters: { ...created.detail.requestParameters, credentialAgeDays: 30 } };
    expect(classify(detail, [])?.severity).toBe('MEDIUM');
  });

  it('ignores keys for other services such as CodeCommit', () => {
    const detail = { ...created.detail, requestParameters: { serviceName: 'codecommit.amazonaws.com', userName: 'ci' } };
    expect(classify(detail, [])).toBeNull();
  });

  it('reports bearer token calls with a dedup key', () => {
    const finding = classify(bearer.detail, []);
    expect(finding?.kind).toBe('KEY_USED');
    expect(finding?.dedupKey).toBe('arn:aws:iam::111122223333:user/BedrockAPIKey-x7k2#bearer');
    expect(finding?.body).toMatch(/probably a long-term key/);
  });

  it('stays silent for allowed principals', () => {
    const allowed = parseAllowList(' arn:aws:iam::111122223333:user/BedrockAPIKey-x7k2 , ');
    expect(classify(bearer.detail, allowed)).toBeNull();
  });

  it('ignores regular SigV4 calls without a bearer token', () => {
    const detail = { ...bearer.detail, additionalEventData: { inferenceRegion: 'eu-west-1' } };
    expect(classify(detail, [])).toBeNull();
  });

  it('uses the role instead of the session for roles', () => {
    expect(principalOf(created.detail)).toBe('arn:aws:iam::111122223333:role/Developer');
  });
});

describe('handler', () => {
  it('sends only one alert per time window', async () => {
    const sent: string[] = [];
    const claimed = new Set<string>();
    const handler = createHandler({
      allowList: [],
      now: () => 1_700_000_000_000,
      publish: async (subject) => { sent.push(subject); },
      claimAlert: async (key) => { if (claimed.has(key)) return false; claimed.add(key); return true; },
    });
    expect(await handler(bearer)).toBe('alerted');
    expect(await handler(bearer)).toBe('deduplicated');
    expect(await handler(created)).toBe('alerted');
    expect(sent).toHaveLength(2);
  });
});
