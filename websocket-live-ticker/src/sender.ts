// src/sender.ts
import {
  ApiGatewayManagementApiClient,
  GoneException,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import type { Sender } from './broadcast.ts';

// endpoint: https://<api-id>.execute-api.<region>.amazonaws.com/<stage>
export function createApiGatewaySender(endpoint: string): Sender {
  const client = new ApiGatewayManagementApiClient({ endpoint });
  return {
    async send(connectionId, data) {
      try {
        await client.send(
          new PostToConnectionCommand({ ConnectionId: connectionId, Data: data }),
        );
        return 'sent';
      } catch (err) {
        // 410: The connection no longer exists, e.g. because $disconnect got lost.
        if (err instanceof GoneException) return 'gone';
        throw err;
      }
    },
  };
}
