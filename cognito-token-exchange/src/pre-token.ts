// src/pre-token.ts
// Pre token generation trigger: token exchange only for users who allowed AI access
import type { PreTokenGenerationV2TriggerEvent } from 'aws-lambda';

export const handler = async (event: PreTokenGenerationV2TriggerEvent) => {
  // The string comes from the Cognito docs; the aws-lambda types don't know it yet
  const quelle: string = event.triggerSource;
  if (quelle === 'TokenGeneration_TokenExchange') {
    if (event.request.userAttributes['custom:ki_freigabe'] !== 'ja') {
      throw new Error('AI access is not enabled for this account');
    }
  }
  return event;
};
