import { getToken } from '@/src/services/authService';
import { getWebSocketConfigWarning, WS_BASE_URL } from '@/src/config/socket';
import { isTokenExpired, clearStoredToken, UNAUTHORIZED_EVENT } from '@/src/utils/apiFetch';

type SocketEventHandler = (payload: any) => void;

export class ChatSocketClient {
  private socket: WebSocket | null = null;
  private handlers = new Set<SocketEventHandler>();
  private reconnectTimer: number | null = null;
  private manualClose = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3;
  private joinedConversationId: string | null = null;
  private joinedPersonaId: string | null = null;
  private joinedSpaceId: string | null = null;

  connect() {
    if (this.socket || !WS_BASE_URL) {
      return;
    }

    const configWarning = getWebSocketConfigWarning();
    if (configWarning) {
      for (const handler of this.handlers) {
        handler({ type: 'socket_disabled', reason: configWarning });
      }
      return;
    }

    const token = getToken();
    if (!token || isTokenExpired(token)) {
      clearStoredToken();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
      }
      return;
    }

    const url = new URL(WS_BASE_URL);
    url.searchParams.set('token', token);

    this.manualClose = false;
    this.socket = new WebSocket(url.toString());

    this.socket.addEventListener('open', () => {
      this.reconnectAttempts = 0;
      for (const handler of this.handlers) {
        handler({ type: 'socket_open' });
      }
      if (this.joinedConversationId && this.joinedPersonaId) {
        this.joinConversation(this.joinedConversationId, this.joinedPersonaId);
      }
      if (this.joinedSpaceId) {
        this.joinSpace(this.joinedSpaceId);
      }
    });

    this.socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(event.data);
        for (const handler of this.handlers) {
          handler(payload);
        }
      } catch (_error) {
        // ignore malformed payloads
      }
    });

    this.socket.addEventListener('close', () => {
      this.socket = null;
      for (const handler of this.handlers) {
        handler({ type: 'socket_close' });
      }
      if (!this.manualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts += 1;
        this.reconnectTimer = window.setTimeout(() => {
          this.connect();
        }, 1500 * this.reconnectAttempts);
      }
    });

    this.socket.addEventListener('error', () => {
      for (const handler of this.handlers) {
        handler({
          type: 'socket_error',
          reason: 'Realtime connection failed. Falling back to standard chat delivery.',
        });
      }
    });
  }

  onEvent(handler: SocketEventHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  isReady() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  send(payload: Record<string, unknown>) {
    if (!this.isReady()) {
      return false;
    }

    this.socket?.send(JSON.stringify(payload));
    return true;
  }

  joinConversation(conversationId: string, personaId: string) {
    this.joinedConversationId = conversationId;
    this.joinedPersonaId = personaId;
    return this.send({
      action: 'joinconversation',
      conversationId,
      personaId,
    });
  }

  leaveConversation() {
    this.joinedConversationId = null;
    this.joinedPersonaId = null;
    return this.send({
      action: 'leaveconversation',
    });
  }

  joinSpace(spaceId: string) {
    this.joinedSpaceId = spaceId;
    return this.send({
      action: 'joinspace',
      spaceId,
    });
  }

  leaveSpace() {
    this.joinedSpaceId = null;
    return this.send({
      action: 'leavespace',
    });
  }

  sendSpaceMessage(spaceId: string, message: string, tempId: string) {
    return this.send({
      action: 'sendspacemessage',
      spaceId,
      message,
      tempId,
    });
  }

  close() {
    this.manualClose = true;
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
  }
}

export function isWebSocketConfigured() {
  return Boolean(WS_BASE_URL);
}
