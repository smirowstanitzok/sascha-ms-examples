// src/middlewares/correlation-id.ts
import { randomUUID } from 'node:crypto';
import type { MiddlewareObj } from '@middy/core';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from 'aws-lambda';

export type CorrelatedContext = Context & { correlationId: string };

interface Options {
  headerName?: string;
}

const defaults: Required<Options> = { headerName: 'x-correlation-id' };

export const correlationId = (
  opts: Options = {},
): MiddlewareObj<
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Error,
  CorrelatedContext
> => {
  const { headerName } = { ...defaults, ...opts };

  const setHeader = (
    response: APIGatewayProxyStructuredResultV2 | null | undefined,
    id: string,
  ) => {
    if (!response) return;
    response.headers = { ...response.headers, [headerName]: id };
  };

  return {
    name: 'correlationId',
    before: (request) => {
      // header-normalizer has already lower-cased all header names
      const incoming = request.event.headers?.[headerName];
      request.context.correlationId = incoming ?? randomUUID();
    },
    after: (request) => {
      setHeader(request.response, request.context.correlationId);
    },
    onError: (request) => {
      // runs after http-error-handler, which has built the error response
      setHeader(request.response, request.context.correlationId);
    },
  };
};
