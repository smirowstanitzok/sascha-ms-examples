// src/problem.ts
import { assertNever } from './result.ts';
import type { ReservationError } from './errors.ts';

// The data model from RFC 9457, section 3
export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [extension: string]: unknown;
};

export type HttpResponse = { statusCode: number; headers: Record<string, string>; body: string };

type ProblemType = { slug: string; title: string; status: number; help: string };

// One entry per error kind. "satisfies" makes sure no kind is missing.
export const PROBLEM_TYPES = {
  InvalidInput: {
    slug: 'invalid-input',
    title: 'The request contains invalid fields.',
    status: 400,
    help: 'Check the fields that errors[].pointer refers to and send the request again.',
  },
  BikeNotFound: {
    slug: 'bike-not-found',
    title: 'This bike does not exist.',
    status: 404,
    help: 'The bikeId is not in the fleet. Reload the list of bikes.',
  },
  BikeUnavailable: {
    slug: 'bike-unavailable',
    title: 'The bike is already booked for this period.',
    status: 409,
    help: 'The freeFrom member holds the earliest free time. Offer it as an alternative.',
  },
  LimitReached: {
    slug: 'limit-reached',
    title: 'Too many active reservations.',
    status: 422,
    help: 'A new reservation is possible once a bike has been returned.',
  },
} as const satisfies Record<ReservationError['kind'], ProblemType>;

// Replace with your own domain that stays stable over time
const baseUrl = () => process.env.PROBLEM_BASE_URL ?? 'https://api.bikerental.example/problems/';

export const typeUri = (kind: ReservationError['kind']) => new URL(PROBLEM_TYPES[kind].slug, baseUrl()).href;

function head(kind: ReservationError['kind'], instance?: string): ProblemDetails {
  const t = PROBLEM_TYPES[kind];
  return { type: typeUri(kind), title: t.title, status: t.status, ...(instance ? { instance } : {}) };
}

export function toProblem(error: ReservationError, instance?: string): ProblemDetails {
  switch (error.kind) {
    case 'InvalidInput':
      return { ...head(error.kind, instance), detail: `${error.issues.length} field(s) invalid.`, errors: error.issues };
    case 'BikeNotFound':
      return { ...head(error.kind, instance), detail: `Bike ${error.bikeId} is not in the fleet.`, bikeId: error.bikeId };
    case 'BikeUnavailable':
      return {
        ...head(error.kind, instance),
        detail: `Bike ${error.bikeId} is free again from ${error.freeFrom}.`,
        bikeId: error.bikeId,
        freeFrom: error.freeFrom,
      };
    case 'LimitReached':
      return { ...head(error.kind, instance), detail: `At most ${error.max} active reservations per customer.`, maxActive: error.max };
    default:
      return assertNever(error);
  }
}

// For failures: about:blank, title = status phrase, no internals exposed
export function internalProblem(instance?: string): ProblemDetails {
  return {
    type: 'about:blank',
    title: 'Internal Server Error',
    status: 500,
    detail: 'Unexpected error. Please try again later and quote the instance if you contact support.',
    ...(instance ? { instance } : {}),
  };
}

export function problemResponse(problem: ProblemDetails): HttpResponse {
  return {
    statusCode: problem.status, // must match the status member
    headers: { 'content-type': 'application/problem+json', 'content-language': 'de' },
    body: JSON.stringify(problem),
  };
}

export const created = (payload: unknown): HttpResponse => ({
  statusCode: 201,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
});
