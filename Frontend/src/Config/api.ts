const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || '';

if (!rawApiBaseUrl) {
  throw new Error('Missing VITE_API_BASE_URL environment variable');
}

export const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, '');

try {
  const url = new URL(API_BASE_URL);
  const invalidEndpointPath = /\/(auth|chat|agents|messages|personas|upload)(\/|$)/.test(url.pathname);
  if (invalidEndpointPath) {
    throw new Error(
      'VITE_API_BASE_URL must be API stage base (example: https://<api-id>.execute-api.<region>.amazonaws.com/dev), not a route like /chat/send.'
    );
  }
} catch (error) {
  if (error instanceof TypeError) {
    throw new Error('VITE_API_BASE_URL must be a valid absolute URL');
  }
  throw error;
}
