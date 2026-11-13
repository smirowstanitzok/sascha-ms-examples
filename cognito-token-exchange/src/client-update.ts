// src/client-update.ts
// Builds a complete UpdateUserPoolClient request from DescribeUserPoolClient.
// Important: UpdateUserPoolClient resets every field you don't send to its default value.
import type { UpdateUserPoolClientCommandInput, UserPoolClientType } from '@aws-sdk/client-cognito-identity-provider';

const NICHT_AKTUALISIERBAR = ['ClientSecret', 'CreationDate', 'LastModifiedDate'] as const;

export function withAuthFlow(client: UserPoolClientType, flow: string): UpdateUserPoolClientCommandInput {
  const input: Record<string, unknown> = { ...client };
  for (const key of NICHT_AKTUALISIERBAR) delete input[key];
  const flows = new Set<string>(client.ExplicitAuthFlows ?? []);
  flows.add(flow);
  // The SDK doesn't know the new value as a type yet, but sends it unchanged
  input.ExplicitAuthFlows = [...flows];
  return input as unknown as UpdateUserPoolClientCommandInput;
}
