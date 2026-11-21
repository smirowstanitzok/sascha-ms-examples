// edge/block-internal.js – blocks outside access to the check service
function handler(event) {
  return { statusCode: 404, statusDescription: 'Not Found' };
}
