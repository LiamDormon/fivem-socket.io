import { io } from 'socket.io-client';
import { singleton, inject } from 'tsyringe';
import type { SocketConnection, SocketOptions } from './types';
import { Logger } from '../logger';

/**
 * Socket.io manager for FiveM resources
 * Manages connections to socket.io servers
 * Provides connection pooling and reconnection handling
 */
@singleton()
export class SocketManager {
  private connections: Map<string, SocketConnection> = new Map();

  private defaultOptions: SocketOptions = {
    reconnectionAttempts: 3,
    reconnectionDelay: 1000,
    timeout: 5000,
    autoConnect: true,
    headers: {},
    params: {},
  };

  constructor(@inject(Logger) private logger: Logger) {}

  /**
   * Connect to a socket.io server
   * @param url The URL of the socket.io server
   * @param namespace The namespace to connect to
   * @param options Connection options
   * @returns Promise that resolves with the socket connection
   */
  public async connect(url: string, namespace = '/', options?: SocketOptions): Promise<SocketConnection> {
    const connectionKey = this.getConnectionKey(url, namespace);
    const existingConnection = this.connections.get(connectionKey);

    if (existingConnection?.connected) {
      return existingConnection;
    }

    const socketOptions = { ...this.defaultOptions, ...options };

    try {
      // Create a new socket connection and store it in the connections map
      const socket = io(`${url}${namespace}`, {
        reconnectionAttempts: socketOptions.reconnectionAttempts,
        reconnectionDelay: socketOptions.reconnectionDelay,
        timeout: socketOptions.timeout,
        autoConnect: socketOptions.autoConnect,
        extraHeaders: socketOptions.headers,
        query: socketOptions.params,
      });

      const connection: SocketConnection = {
        socket,
        url,
        namespace,
        reconnectAttempts: 0,
        connected: false,
        listeners: new Map(),
      };

      this.setupConnectionHandlers(connection);

      this.connections.set(connectionKey, connection);

      await this.waitForConnection(connection);

      return connection;
    } catch (error) {
      this.logger.error(`Failed to connect to socket ${url}${namespace}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to an event on a socket connection
   * @param url The URL of the socket.io server
   * @param namespace The namespace to connect to
   * @param event The event name to subscribe to
   * @param callback Callback function to execute when event is received
   * @param options Connection options including headers and params
   */
  public async subscribe(
    url: string, 
    namespace = '/', 
    event: string, 
    callback: (data: any) => void, 
    options?: SocketOptions
  ): Promise<void> {
    const connection = await this.getOrCreateConnection(url, namespace, options);

    // Add event listener to the connection if it doesn't exist
    if (!connection.listeners.has(event)) {
      connection.listeners.set(event, new Set());
      connection.socket.on(event, (data: any) => {
        const eventListeners = connection.listeners.get(event);
        if (eventListeners) {
          eventListeners.forEach((listener) => listener(data));
        }
      });
    }

    // Add callback to the event listeners
    const eventListeners = connection.listeners.get(event);
    if (eventListeners) {
      eventListeners.add(callback);
    }
  }

  /**
   * Unsubscribe from an event on a socket connection
   * @param url The URL of the socket.io server
   * @param namespace The namespace to connect to
   * @param event The event name to unsubscribe from
   * @param callback Callback function to remove
   * @param options Connection options including headers and params
   */
  public async unsubscribe(
    url: string, 
    namespace = '/', 
    event: string, 
    callback?: (data: any) => void, 
    options?: SocketOptions
  ): Promise<void> {
    const connectionKey = this.getConnectionKey(url, namespace);
    const connection = this.connections.get(connectionKey);

    if (!connection) return;

    // If a callback is provided, remove it from the event listeners
    // If no callback is provided, remove all listeners for the event
    if (callback && connection.listeners.has(event)) {
      const eventListeners = connection.listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(callback);

        if (eventListeners.size === 0) {
          connection.listeners.delete(event);
          connection.socket.off(event);
        }
      }
    } else if (!callback && connection.listeners.has(event)) {
      connection.listeners.delete(event);
      connection.socket.off(event);
    }
  }

  /**
   * Publish an event to a socket connection
   * @param url The URL of the socket.io server
   * @param namespace The namespace to connect to
   * @param event The event name to publish
   * @param data The data to publish
   * @param options Connection options including headers and params
   */
  public async publish(
    url: string, 
    namespace = '/', 
    event: string, 
    data: any, 
    options?: SocketOptions
  ): Promise<void> {
    const connection = await this.getOrCreateConnection(url, namespace, options);

    if (!connection.connected) {
      throw new Error(`Socket not connected: ${url}${namespace}`);
    }

    connection.socket.emit(event, data);
  }

  /**
   * Disconnect from a socket connection
   * @param url The URL of the socket.io server
   * @param namespace The namespace to disconnect from
   */
  public disconnect(url: string, namespace = '/'): void {
    const connectionKey = this.getConnectionKey(url, namespace);
    const connection = this.connections.get(connectionKey);

    if (connection) {
      connection.socket.disconnect();
      this.connections.delete(connectionKey);
    }
  }

  /**
   * Disconnect from all socket connections
   */
  public disconnectAll(): void {
    this.connections.forEach((connection) => {
      connection.socket.disconnect();
    });
    this.connections.clear();
  }

  /**
   * Get a unique key for a connection
   * @param url The URL of the socket.io server
   * @param namespace The namespace of the connection
   * @returns A unique key for the connection
   */
  private getConnectionKey(url: string, namespace: string): string {
    return `${url}${namespace}`;
  }

  /**
   * Setup connection event handlers
   * @param connection The socket connection
   */
  private setupConnectionHandlers(connection: SocketConnection): void {
    const { socket } = connection;

    socket.on('connect', () => {
      this.logger.info(`Connected to socket ${connection.url}${connection.namespace}`);
      connection.connected = true;
      connection.reconnectAttempts = 0;
    });

    socket.on('disconnect', (reason) => {
      this.logger.info(`Disconnected from socket ${connection.url}${connection.namespace}: ${reason}`);
      connection.connected = false;
    });

    socket.on('connect_error', (error) => {
      this.logger.error(`Connection error for socket ${connection.url}${connection.namespace}:`, error);
      connection.reconnectAttempts += 1;
      connection.connected = false;

      // If we've reached max reconnect attempts, remove the connection
      if (connection.reconnectAttempts >= (this.defaultOptions.reconnectionAttempts || 3)) {
        this.logger.error(`Max reconnection attempts reached for ${connection.url}${connection.namespace}. Giving up.`);
        socket.disconnect();
        this.connections.delete(this.getConnectionKey(connection.url, connection.namespace));
      }
    });
  }

  /**
   * Get or create a socket connection
   * @param url The URL of the socket.io server
   * @param namespace The namespace to connect to
   * @param options Connection options
   * @returns The socket connection
   */
  private async getOrCreateConnection(url: string, namespace = '/', options?: SocketOptions): Promise<SocketConnection> {
    const connectionKey = this.getConnectionKey(url, namespace);
    const existingConnection = this.connections.get(connectionKey);

    if (existingConnection?.connected) {
      return existingConnection;
    }

    return this.connect(url, namespace, options);
  }

  /**
   * Wait for a connection to establish
   * @param connection The socket connection to wait for
   * @returns A promise that resolves when the connection is established
   */
  private waitForConnection(connection: SocketConnection): Promise<void> {
    return new Promise((resolve, reject) => {
      if (connection.connected) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        connection.socket.off('connect');
        connection.socket.off('connect_error');
        reject(new Error(`Connection timeout for ${connection.url}${connection.namespace}`));
      }, this.defaultOptions.timeout);

      connection.socket.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });

      connection.socket.once('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }
}
