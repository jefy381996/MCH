import { useEffect, useState } from 'react';
import { getJSON, type IndexPayload } from './api.ts';

export type Connection = 'connecting' | 'live' | 'polling';

const POLL_MS = 15_000;
const MAX_BACKOFF_MS = 30_000;

/**
 * The current index, pushed over a WebSocket. If the socket drops, it polls
 * the REST endpoint while it reconnects with backoff, so the page never goes
 * stale silently.
 */
export function useLiveIndex(): { data: IndexPayload | null; connection: Connection } {
  const [data, setData] = useState<IndexPayload | null>(null);
  const [connection, setConnection] = useState<Connection>('connecting');

  useEffect(() => {
    let socket: WebSocket | undefined;
    let closed = false;
    let backoff = 1_000;
    let reconnectTimer: number | undefined;
    let pollTimer: number | undefined;

    const poll = () =>
      getJSON<IndexPayload>('/api/index')
        .then((payload) => !closed && setData(payload))
        .catch(() => {});

    const startPolling = () => {
      if (pollTimer === undefined) pollTimer = window.setInterval(poll, POLL_MS);
    };
    const stopPolling = () => {
      window.clearInterval(pollTimer);
      pollTimer = undefined;
    };

    const connect = () => {
      const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/stream`;
      socket = new WebSocket(url);
      socket.onopen = () => {
        backoff = 1_000;
        stopPolling();
        setConnection('live');
      };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as { type: string; data: IndexPayload };
          if (message.type === 'index') setData(message.data);
        } catch {
          // Ignore malformed frames; the next one will do.
        }
      };
      socket.onclose = () => {
        if (closed) return;
        setConnection('polling');
        startPolling();
        reconnectTimer = window.setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      };
    };

    void poll();
    connect();
    return () => {
      closed = true;
      window.clearTimeout(reconnectTimer);
      stopPolling();
      socket?.close();
    };
  }, []);

  return { data, connection };
}
