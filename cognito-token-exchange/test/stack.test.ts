// test/stack.test.ts
import { describe, expect, it } from 'vitest';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { TokenExchangeStack } from '../lib/token-exchange-stack.js';

const template = Template.fromStack(new TokenExchangeStack(new App(), 'Test', { env: { region: 'eu-central-1' } }));

describe('TokenExchangeStack', () => {
  it('uses the Essentials plan', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', { UserPoolTier: 'ESSENTIALS' });
  });

  it('gives the agent a confidential client with client credentials', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      GenerateSecret: true,
      AllowedOAuthFlows: ['client_credentials'],
    });
  });

  it('binds the orders API to the audience "bestellungen"', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Authorizer', {
      JwtConfiguration: Match.objectLike({ Audience: ['bestellungen'] }),
    });
  });

  it('creates functions for agent, API and trigger', () => {
    expect(Object.keys(template.findResources('AWS::Lambda::Function')).length).toBeGreaterThanOrEqual(3);
  });
});
