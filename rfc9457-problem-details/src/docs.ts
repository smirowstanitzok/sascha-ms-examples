// src/docs.ts
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { PROBLEM_TYPES, problemResponse, type HttpResponse } from './problem.ts';

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

// Serves a short HTML doc for every type URI (RFC 9457 recommends this)
export async function problemDocs(event: APIGatewayProxyEventV2): Promise<HttpResponse> {
  const slug = event.pathParameters?.slug;
  const entry = Object.values(PROBLEM_TYPES).find((t) => t.slug === slug);
  if (!entry) {
    return problemResponse({ type: 'about:blank', title: 'Not Found', status: 404 });
  }
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escapeHtml(entry.title)}</title>
<h1>${escapeHtml(entry.title)}</h1><p>HTTP status: ${entry.status}</p><p>${escapeHtml(entry.help)}</p></html>`;
  return { statusCode: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, body: html };
}
