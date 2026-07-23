import { API_BASE_URL } from '@/src/config/api';

const rawWebSocketUrl = (import.meta.env.VITE_WS_BASE_URL as string | undefined)?.trim() || '';

export const WS_BASE_URL = rawWebSocketUrl ? rawWebSocketUrl.replace(/\/+$/, '') : '';
const expectedRestDerivedSocketUrl = API_BASE_URL.replace(/^http/, 'ws');
export const WS_ENDPOINT_LOOKS_LIKE_REST =
  Boolean(WS_BASE_URL) && WS_BASE_URL.replace(/\/+$/, '') === expectedRestDerivedSocketUrl.replace(/\/+$/, '');

if (WS_BASE_URL) {
  try {
    const url = new URL(WS_BASE_URL);
    if (!(url.protocol === 'ws:' || url.protocol === 'wss:')) {
      throw new Error('VITE_WS_BASE_URL must use ws:// or wss://');
    }
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('VITE_WS_BASE_URL must be a valid absolute websocket URL');
    }
    throw error;
  }
}

export function getWebSocketConfigWarning() {
  if (!WS_BASE_URL) {
    return '';
  }

  if (WS_ENDPOINT_LOOKS_LIKE_REST) {
    return 'VITE_WS_BASE_URL is pointing at the REST API URL. Use the dedicated WebSocketApiUrl output from the backend stack instead.';
  }

  return '';
}
