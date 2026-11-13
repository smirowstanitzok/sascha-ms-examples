// test/client-update.test.ts
import { describe, expect, it } from 'vitest';
import { withAuthFlow } from '../src/client-update.js';

describe('withAuthFlow', () => {
  const client = {
    UserPoolId: 'eu-central-1_Example',
    ClientId: 'agent123',
    ClientName: 'AgentClient',
    ClientSecret: 'secret',
    AllowedOAuthFlows: ['client_credentials'],
    AllowedOAuthScopes: ['buchladen-agent/handeln', 'bestellungen/lesen'],
    ExplicitAuthFlows: ['ALLOW_REFRESH_TOKEN_AUTH'],
  } as never;

  it('adds the flow and keeps the other settings', () => {
    const input = withAuthFlow(client, 'ALLOW_TOKEN_EXCHANGE_DELEGATION');
    expect(input.ExplicitAuthFlows).toEqual(['ALLOW_REFRESH_TOKEN_AUTH', 'ALLOW_TOKEN_EXCHANGE_DELEGATION']);
    expect(input.AllowedOAuthScopes).toEqual(['buchladen-agent/handeln', 'bestellungen/lesen']);
  });

  it('does not send the client secret', () => {
    expect(withAuthFlow(client, 'ALLOW_TOKEN_EXCHANGE_DELEGATION')).not.toHaveProperty('ClientSecret');
  });
});
