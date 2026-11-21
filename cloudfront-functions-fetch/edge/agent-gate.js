// edge/agent-gate.js – CloudFront Function, JavaScript runtime 2.0, viewer request
import cf from 'cloudfront';

const AUTH_ORIGIN = 'agent-auth'; // origin ID in the distribution

function deny(statusCode, statusDescription, reason) {
  return {
    statusCode: statusCode,
    statusDescription: statusDescription,
    headers: { 'content-type': { value: 'application/json' } },
    body: { encoding: 'text', data: JSON.stringify({ reason: reason }) },
  };
}

async function handler(event) {
  const request = event.request;
  const token = request.headers['x-agent-token'];

  // No token, no lookup: saves a network call
  if (!token || !token.value) {
    return deny(401, 'Unauthorized', 'missing_token');
  }

  try {
    const response = await cf.fetch('/check', {
      originId: AUTH_ORIGIN,
      headers: { 'x-agent-token': token.value, 'x-requested-path': request.uri },
      includeBody: true,
    });

    if (response.status === 429) {
      return deny(429, 'Too Many Requests', 'budget');
    }
    if (!response.ok) {
      return deny(403, 'Forbidden', 'not_allowed');
    }

    const result = await response.json();
    // Do not pass the token to the API, send the verified agent ID instead
    delete request.headers['x-agent-token'];
    request.headers['x-agent-id'] = { value: result.agentId };
    request.headers['x-agent-remaining'] = { value: String(result.remaining) };
    return request;
  } catch (e) {
    // Fail closed: if the check service is unreachable, nobody gets through
    console.log('agent check failed: ' + e.name + ': ' + e.message);
    return deny(503, 'Service Unavailable', 'auth_unavailable');
  }
}
