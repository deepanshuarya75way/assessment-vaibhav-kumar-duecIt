import { API_URL } from './api';

export type WSEvent = {
  type: string;
  data: Record<string, unknown>;
};

type Handler = (data: Record<string, unknown>) => void;

export class WSClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<Handler>>();
  private token: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect(token: string): Promise<void> {
    this.token = token;
    if (this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const wsUrl = API_URL.replace(/^http/, 'ws') + `/ws?token=${token}`;
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        resolve();
      };

      ws.onmessage = (ev) => {
        try {
          const event: WSEvent = JSON.parse(ev.data);
          const set = this.handlers.get(event.type);
          if (set) set.forEach((h) => h(event.data));
        } catch {
          /* ignore */
        }
      };

      ws.onerror = () => {
        reject(new Error('WebSocket connection failed'));
      };

      ws.onclose = () => {
        this.ws = null;
        if (this.token) {
          this.reconnectTimer = setTimeout(() => {
            this.connect(this.token!).catch(() => {});
          }, 3000);
        }
      };
    });
  }

  on(event: string, handler: Handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return () => this.handlers.get(event)?.delete(handler);
  }

  disconnect() {
    this.token = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.handlers.clear();
  }
}

export const wsClient = new WSClient();
