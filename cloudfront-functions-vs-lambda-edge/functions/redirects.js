// functions/redirects.js – CloudFront Function (JavaScript runtime 2.0), viewer request
import cf from 'cloudfront';

// Uses the key value store associated with this function
const redirects = cf.kvs();

async function handler(event) {
  const request = event.request;
  const uri = request.uri;

  // 1. Permanent redirects for old URLs, maintained in the KeyValueStore.
  //    A single get() costs one read; get() throws if the key does not exist.
  let target = null;
  try {
    target = await redirects.get(uri);
  } catch (err) {
    // Key not found: not an old URL
  }
  if (target) {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: {
        location: { value: target },
        'cache-control': { value: 'max-age=3600' }
      }
    };
  }

  // 2. Pretty URLs: /touren/ and /touren become /touren/index.html
  if (uri.endsWith('/')) {
    request.uri = uri + 'index.html';
  } else if (!uri.split('/').pop().includes('.')) {
    request.uri = uri + '/index.html';
  }

  return request;
}
