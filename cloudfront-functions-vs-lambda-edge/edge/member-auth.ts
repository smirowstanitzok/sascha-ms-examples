// edge/member-auth.ts – Lambda@Edge, viewer request for /mitglieder/*
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type {
  CloudFrontHeaders,
  CloudFrontRequestEvent,
  CloudFrontRequestResult
} from 'aws-lambda';
import { config } from './config.js';

// Created once per execution environment; the JWKS is cached after the first download
export const verifier = CognitoJwtVerifier.create({
  userPoolId: config.userPoolId,
  clientId: config.clientId,
  tokenUse: 'id'
});

export function readCookie(headers: CloudFrontHeaders, name: string): string | undefined {
  for (const header of headers.cookie ?? []) {
    for (const part of header.value.split(';')) {
      const [key, ...rest] = part.trim().split('=');
      if (key === name) return rest.join('=');
    }
  }
  return undefined;
}

function redirectToLogin(uri: string): CloudFrontRequestResult {
  return {
    status: '302',
    statusDescription: 'Found',
    headers: {
      location: [{ key: 'Location', value: `${config.loginPath}?next=${encodeURIComponent(uri)}` }],
      'cache-control': [{ key: 'Cache-Control', value: 'no-store' }]
    }
  };
}

export const handler = async (event: CloudFrontRequestEvent): Promise<CloudFrontRequestResult> => {
  const request = event.Records[0].cf.request;
  const token = readCookie(request.headers, 'id_token');

  if (!token) return redirectToLogin(request.uri);

  try {
    await verifier.verify(token);
  } catch {
    return redirectToLogin(request.uri);
  }

  // No CloudFront Function can run here (viewer request), so we handle pretty URLs ourselves
  if (request.uri.endsWith('/')) request.uri += 'index.html';
  return request; // valid token: CloudFront continues with cache or origin
};
