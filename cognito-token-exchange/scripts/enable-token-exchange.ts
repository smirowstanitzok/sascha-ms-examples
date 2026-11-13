// scripts/enable-token-exchange.ts
// Usage: npx tsx scripts/enable-token-exchange.ts <user-pool-id> <agent-client-id>
import {
  CognitoIdentityProviderClient,
  DescribeUserPoolClientCommand,
  UpdateUserPoolClientCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { withAuthFlow } from '../src/client-update.js';

const [userPoolId, clientId] = process.argv.slice(2);
if (!userPoolId || !clientId) {
  console.error('Usage: npx tsx scripts/enable-token-exchange.ts <user-pool-id> <agent-client-id>');
  process.exit(1);
}

const cognito = new CognitoIdentityProviderClient({});
const { UserPoolClient } = await cognito.send(new DescribeUserPoolClientCommand({ UserPoolId: userPoolId, ClientId: clientId }));
const input = withAuthFlow(UserPoolClient!, 'ALLOW_TOKEN_EXCHANGE_DELEGATION');
await cognito.send(new UpdateUserPoolClientCommand(input));
console.log('Auth flows now:', input.ExplicitAuthFlows?.join(', '));
