// src/middlewares/validate-body.ts
import createError from 'http-errors';
import type { MiddlewareObj } from '@middy/core';

export type Check<T> = (body: unknown) => { ok: true; value: T } | { ok: false; problems: string[] };

export const validateBody = <T>(check: Check<T>): MiddlewareObj<{ body?: unknown }> => ({
  name: 'validateBody',
  before: (request) => {
    const result = check(request.event.body);
    if (!result.ok) {
      throw createError(400, JSON.stringify({ message: 'Invalid request', problems: result.problems }));
    }
    request.event.body = result.value;
  },
});
