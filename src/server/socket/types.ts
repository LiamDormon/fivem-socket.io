import type { Socket } from 'socket.io-client';

export interface SocketConnection {
  socket: Socket;
  url: string;
  namespace: string;
  reconnectAttempts: number;
  connected: boolean;
  listeners: Map<string, Set<(data: any) => void>>;
}

export interface SocketOptions {
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  timeout?: number;
  autoConnect?: boolean;
  headers?: Record<string, string>;
  params?: Record<string, any>;
}
