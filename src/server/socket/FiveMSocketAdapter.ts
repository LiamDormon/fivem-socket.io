import { singleton, inject } from 'tsyringe';
import { SocketManager } from './SocketManager';
import { Logger } from '../logger';
import { 
  isValidUrl,
  isValidNamespace,
  isValidEvent,
  isValidOptions,
  formatErrorMessage,
  normaliseUrl,
  sanitiseData
} from '../validations';

/**
 * FiveM adapter for the SocketManager
 * Exposes the SocketManager functionality as exports and events
 */
@singleton()
export class FiveMSocketAdapter {
  /**
   * Constructor with dependency injection
   * @param socketManager Injected socket manager instance
   * @param logger Injected logger instance
   */
  constructor(
    @inject(SocketManager) private socketManager: SocketManager,
    @inject(Logger) private logger: Logger
  ) {
    this.registerExports();
    this.registerEvents();
  }

  /**
   * Safely emit a FiveM event with error handling
   * @param eventName Event name to emit
   * @param target Target to emit to (-1 for broadcast, source ID for specific client)
   * @param args Arguments to pass with the event
   * @returns true if emit was successful, false otherwise
   */
  private safeEmit(eventName: string, target: number | string, ...args: any[]): boolean {
    if (!eventName || typeof eventName !== 'string' || eventName.length === 0) {
      this.logger.error('Invalid event name provided for emit:', eventName);
      return false;
    }

    try {
      if (target === 'server') {
        // Server-only event
        emit(eventName, ...args);
      } else {
        // Client event
        emitNet(eventName, target, ...args);
      }
      return true;
    } catch (error) {
      this.logger.error(`Failed to emit event "${eventName}":`, error);
      return false;
    }
  }
  
  
  /**
   * Register all exports for the resource
   */
  private registerExports(): void {
    // Connect to a socket
    exports('socketConnect', async (url: string, namespace: string = '/', options?: any) => {
      try {
        // Try to normalise URL
        const normalisedUrl = normaliseUrl(url);
        if (!normalisedUrl) {
          const errorMsg = formatErrorMessage('Invalid URL provided, could not normalise', String(url));
          this.logger.error(errorMsg);
          return { success: false, error: 'Invalid URL format. Expected format: http(s)://hostname[:port]' };
        }
        url = normalisedUrl;
        
        // Input validation
        if (!isValidUrl(url)) {
          const errorMsg = formatErrorMessage('Invalid URL format after normalization', url);
          this.logger.error(errorMsg);
          return { success: false, error: 'Invalid URL format. Expected format: http(s)://hostname[:port]' };
        }
        
        if (!isValidNamespace(namespace)) {
          namespace = '/'; // Default to root namespace
          this.logger.warn(`Invalid namespace provided. Using default: '/'`);
        }
        
        // Sanitise options
        if (options) {
          try {
            if (options.headers) {
              options.headers = sanitiseData(options.headers);
            }
            
            if (options.params) {
              options.params = sanitiseData(options.params);
            }
          } catch (sanitiseError) {
            this.logger.error(`Error sanitising options:`, sanitiseError);
          }
          
          if (!isValidOptions(options)) {
            const errorMsg = formatErrorMessage('Invalid options object', url, namespace);
            this.logger.error(errorMsg, options);
            return { success: false, error: 'Invalid options format' };
          }
        }
        
        this.logger.info(`Attempting to connect to ${url}${namespace}`);
        
        // Add connection timeout handling
        const timeoutMs = (options && typeof options.timeout === 'number') ? options.timeout : 5000;
        let connectionTimedOut = false;
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            connectionTimedOut = true;
            reject(new Error(`Connection timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        });
        
        // Race the connection against the timeout
        await Promise.race([
          this.socketManager.connect(url, namespace, options),
          timeoutPromise
        ]);
        
        if (connectionTimedOut) {
          return { 
            success: false, 
            error: `Connection timed out after ${timeoutMs}ms`,
            details: {
              url,
              namespace,
              timeoutMs
            }
          };
        }
        
        this.logger.info(`Successfully connected to ${url}${namespace}`);
        
        return { 
          success: true,
          url: url,
          namespace: namespace
        };
      } catch (error) {
        const errorMsg = formatErrorMessage(`Failed to connect to socket: ${error.message || 'Unknown error'}`, url, namespace);
        this.logger.error(errorMsg);
        this.logger.error('[fivem-socket.io] Error details:', error);
        
        return { 
          success: false, 
          error: error.message || 'Unknown connection error',
          details: {
            url,
            namespace,
            options: options ? { 
              hasHeaders: !!options.headers,
              hasParams: !!options.params,
              timeout: options.timeout,
              reconnectionAttempts: options.reconnectionAttempts
            } : undefined
          }
        };
      }
    });

    // Subscribe to an event
    exports('socketSubscribe', async (url: any, namespace: any = '/', event: any, callbackEvent: any, options?: any) => {
      try {
        const normalisedUrl = normaliseUrl(url);
        if (!normalisedUrl) {
          const errorMsg = formatErrorMessage('Invalid URL provided for subscription, could not normalise', String(url));
          this.logger.error(errorMsg);
          return { success: false, error: 'Invalid URL format. Expected format: http(s)://hostname[:port]' };
        }
        url = normalisedUrl;
        
        // Validations
        if (!isValidUrl(url)) {
          const errorMsg = formatErrorMessage('Invalid URL format after normalization', url);
          this.logger.error(errorMsg);
          return { success: false, error: 'Invalid URL format. Expected format: http(s)://hostname[:port]' };
        }

        if (!isValidNamespace(namespace)) {
          namespace = '/'; // Default to root namespace
          this.logger.warn(`[fivem-socket.io] Invalid namespace provided for subscription. Using default: '/'`);
        }

        if (!isValidEvent(event)) {
          const errorMsg = formatErrorMessage('Invalid event name provided', url, namespace);
          this.logger.error(errorMsg);
          return { success: false, error: 'Invalid event name' };
        }
        
        if (!callbackEvent || typeof callbackEvent !== 'string') {
          const errorMsg = formatErrorMessage('Invalid callback event name provided', url, namespace, event);
          this.logger.error(errorMsg);
          return { success: false, error: 'Invalid callback event name' };
        }
        
        // Special check for sensitive event names
        const sensitiveEvents = ['playerConnecting', 'playerDropped', 'onResourceStart', 'onResourceStop'];
        if (sensitiveEvents.includes(callbackEvent)) {
          const errorMsg = formatErrorMessage(`Callback event name "${callbackEvent}" is reserved by FiveM and cannot be used`, url, namespace, event);
          this.logger.error(errorMsg);
          return { success: false, error: 'Reserved callback event name' };
        }
        
        // Sanitise options
        if (options) {
          try {
            if (options.headers) {
              options.headers = sanitiseData(options.headers);
            }
            
            if (options.params) {
              options.params = sanitiseData(options.params);
            }
          } catch (sanitiseError) {
            this.logger.warn(`[fivem-socket.io] Error sanitising options:`, sanitiseError);
          }
          
          if (!isValidOptions(options)) {
            const errorMsg = formatErrorMessage('Invalid options object for subscription', url, namespace, event);
            this.logger.error(errorMsg, options);
            return { success: false, error: 'Invalid options format' };
          }
        }
        
        this.logger.info(`Attempting to subscribe to event '${event}' on ${url}${namespace}`);
        
        // Add subscription timeout handling
        const timeoutMs = (options && typeof options.timeout === 'number') ? options.timeout : 5000;
        let subscriptionTimedOut = false;
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            subscriptionTimedOut = true;
            reject(new Error(`Subscription timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        });
        
        // Create the event handler with additional error handling
        const safeEventHandler = (data: any) => {
          try {
            // Add a try-catch for event handling
            this.logger.debug(`Received event '${event}' on ${url}${namespace}, broadcasting to '${callbackEvent}'`);
            
            // Check if data is valid and sanitise
            try {
              if (data === undefined) {
                data = null; // Use null instead of undefined for consistency in Lua
              } else {
                // Try to sanitise incoming data for safety
                data = sanitiseData(data);
              }
            } catch (sanitiseError) {
              this.logger.warn(`Error sanitising received data:`, sanitiseError);
              // Continue with original data
            }
            
            // Use the safe emit method
            this.safeEmit(callbackEvent, -1, data); // -1 broadcasts to all clients
            this.safeEmit(`socket:${callbackEvent}`, 'server', data);
          } catch (emitError) {
            this.logger.error(`Failed to process event '${event}':`, emitError);
          }
        };
        
        // Race the subscription against the timeout
        await Promise.race([
          this.socketManager.subscribe(url, namespace, event, safeEventHandler, options),
          timeoutPromise
        ]);
        
        if (subscriptionTimedOut) {
          return { 
            success: false, 
            error: `Subscription timed out after ${timeoutMs}ms`,
            details: {
              url,
              namespace,
              event,
              timeoutMs
            }
          };
        }
        
        this.logger.info(`Successfully subscribed to event '${event}' on ${url}${namespace}`);
        return { 
          success: true,
          url: url,
          namespace: namespace,
          event: event,
          callbackEvent: callbackEvent
        };
      } catch (error) {
        const errorMsg = formatErrorMessage(
          `Failed to subscribe to event: ${error.message || 'Unknown error'}`,
          url, 
          namespace, 
          event
        );
        this.logger.error(errorMsg);
        this.logger.error('[fivem-socket.io] Error details:', error);
        
        return { 
          success: false, 
          error: error.message || 'Unknown subscription error',
          details: {
            url,
            namespace,
            event,
            callbackEvent,
            options: options ? { 
              hasHeaders: !!options.headers,
              hasParams: !!options.params,
              timeout: options.timeout,
              reconnectionAttempts: options.reconnectionAttempts
            } : undefined
          }
        };
      }
    });

    // Unsubscribe from an event
    exports('socketUnsubscribe', (url: any, namespace: any = '/', event: any, options?: any) => {
      try {
        // Try to normalise URL
        const normalisedUrl = normaliseUrl(url);
        if (!normalisedUrl) {
          const errorMsg = formatErrorMessage('Invalid URL provided for unsubscription, could not normalise', String(url));
          this.logger.error(errorMsg);
          return { success: false, error: 'Invalid URL format. Expected format: http(s)://hostname[:port]' };
        }
        url = normalisedUrl;
        
        // Validate URL
        if (!isValidUrl(url)) {
          const errorMsg = formatErrorMessage('Invalid URL format after normalization', url);
          this.logger.error(errorMsg);
          return { success: false, error: 'Invalid URL format. Expected format: http(s)://hostname[:port]' };
        }

        // Validate namespace
        if (!isValidNamespace(namespace)) {
          namespace = '/'; // Default to root namespace
          this.logger.warn(`[fivem-socket.io] Invalid namespace provided for unsubscription. Using default: '/'`);
        }
        
        // Validate event
        if (!isValidEvent(event)) {
          const errorMsg = formatErrorMessage('Invalid event name provided for unsubscription', url, namespace);
          this.logger.error(errorMsg);
          return { success: false, error: 'Invalid event name' };
        }
        
        // Sanitise options
        if (options) {
          try {
            // Sanitise headers and params if present
            if (options.headers) {
              options.headers = sanitiseData(options.headers);
            }
            
            if (options.params) {
              options.params = sanitiseData(options.params);
            }
          } catch (sanitiseError) {
            this.logger.warn(`[fivem-socket.io] Error sanitising options:`, sanitiseError);
            // Continue with whatever we have
          }
          
          if (!isValidOptions(options)) {
            const errorMsg = formatErrorMessage('Invalid options object for unsubscription', url, namespace, event);
            this.logger.error(errorMsg, options);
            return { success: false, error: 'Invalid options format' };
          }
        }
        
        this.logger.info(`Attempting to unsubscribe from event '${event}' on ${url}${namespace}`);
        
        // Check if the connection exists before trying to unsubscribe
        const connectionKey = `${url}${namespace}`;
        if (!this.socketManager['connections'] || !this.socketManager['connections'].has(connectionKey)) {
          this.logger.warn(`No active connection found for ${url}${namespace}, skipping unsubscribe`);
          return {
            success: true,
            message: 'No active connection found to unsubscribe from',
            url: url,
            namespace: namespace,
            event: event
          };
        }
        
        this.socketManager.unsubscribe(url, namespace, event, undefined, options);
        
        this.logger.info(`Successfully unsubscribed from event '${event}' on ${url}${namespace}`);
        return { 
          success: true,
          url: url,
          namespace: namespace,
          event: event
        };
      } catch (error) {
        const errorMsg = formatErrorMessage(
          `Failed to unsubscribe from event: ${error.message || 'Unknown error'}`,
          url, 
          namespace, 
          event
        );
        this.logger.error(errorMsg);
        this.logger.error('[fivem-socket.io] Error details:', error);
        
        return { 
          success: false, 
          error: error.message || 'Unknown unsubscription error',
          details: {
            url,
            namespace,
            event,
            options: options ? { 
              hasHeaders: !!options.headers,
              hasParams: !!options.params
            } : undefined
          }
        };
      }
    });

    // Publish an event
    exports('socketPublish', async (url: any, namespace: any = '/', event: any, data: any, options?: any) => {
      try {
        // Try to normalise URL
        const normalisedUrl = normaliseUrl(url);
        if (!normalisedUrl) {
          const errorMsg = formatErrorMessage('Invalid URL provided for publishing, could not normalise', String(url));
          this.logger.error(errorMsg);
          return { success: false, error: 'Invalid URL format. Expected format: http(s)://hostname[:port]' };
        }
        url = normalisedUrl;

        // Validate URL
        if (!isValidUrl(url)) {
          const errorMsg = formatErrorMessage('Invalid URL format after normalization', url);
          this.logger.error(errorMsg);
          return { success: false, error: 'Invalid URL format. Expected format: http(s)://hostname[:port]' };
        }

        // Validate namespace
        if (!isValidNamespace(namespace)) {
          namespace = '/'; // Default to root namespace
          this.logger.warn(`[fivem-socket.io] Invalid namespace provided for publishing. Using default: '/'`);
        }
        
        // Validate event
        if (!isValidEvent(event)) {
          const errorMsg = formatErrorMessage('Invalid event name provided for publishing', url, namespace);
          this.logger.error(errorMsg);
          return { success: false, error: 'Invalid event name' };
        }
        
        // Sanitise data before sending
        try {
          // Sanitise and check data before sending 
          if (data === undefined) {
            this.logger.warn(`Undefined data provided for event '${event}'. Using null instead.`);
            data = null;
          } else {
            // Make sure we have a reasonable data size
            if (typeof data === 'string' && data.length > 1024 * 1024) {  // 1MB limit
              this.logger.warn(`Extremely large string data (${data.length} chars) being sent to event '${event}'. This may cause performance issues.`);
            } else if (data !== null && typeof data === 'object') {
              try {
                const jsonSize = JSON.stringify(data).length;
                if (jsonSize > 1024 * 1024) { // 1MB limit
                  this.logger.warn(`Extremely large object data (${jsonSize} bytes) being sent to event '${event}'. This may cause performance issues.`);
                }
              } catch (err) {
                this.logger.warn(`Could not JSON stringify data for size check: ${err.message}`);
              }
            }
            
            // Try to sanitise the data
            data = sanitiseData(data);
          }
        } catch (err) {
          this.logger.warn(`Error sanitising data for event '${event}':`, err);
          // Continue with original data 
        }
        
        // Sanitise options
        if (options) {
          try {
            // Sanitise headers and params if present
            if (options.headers) {
              options.headers = sanitiseData(options.headers);
            }
            
            if (options.params) {
              options.params = sanitiseData(options.params);
            }
          } catch (sanitiseError) {
            this.logger.warn(`[fivem-socket.io] Error sanitising options:`, sanitiseError);
            // Continue with whatever we have
          }
          
          if (!isValidOptions(options)) {
            const errorMsg = formatErrorMessage('Invalid options object for publishing', url, namespace, event);
            this.logger.error(errorMsg, options);
            return { success: false, error: 'Invalid options format' };
          }
        }
        
        this.logger.info(`Attempting to publish event '${event}' to ${url}${namespace}`);
        
        // Add timeout handling for publishing
        const timeoutMs = (options && typeof options.timeout === 'number') ? options.timeout : 5000;
        let publishTimedOut = false;
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            publishTimedOut = true;
            reject(new Error(`Publish timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        });
        
        // Race the publish against the timeout
        await Promise.race([
          this.socketManager.publish(url, namespace, event, data, options),
          timeoutPromise
        ]);
        
        if (publishTimedOut) {
          return { 
            success: false, 
            error: `Publish timed out after ${timeoutMs}ms`,
            details: {
              url,
              namespace,
              event,
              timeoutMs
            }
          };
        }
        
        this.logger.info(`Successfully published event '${event}' to ${url}${namespace}`);
        return { 
          success: true,
          url: url,
          namespace: namespace,
          event: event 
        };
      } catch (error) {
        const errorMsg = formatErrorMessage(
          `Failed to publish event: ${error.message || 'Unknown error'}`,
          url, 
          namespace, 
          event
        );
        this.logger.error(errorMsg);
        this.logger.error('[fivem-socket.io] Error details:', error);
        
        return { 
          success: false, 
          error: error.message || 'Unknown publish error',
          details: {
            url,
            namespace,
            event,
            dataType: typeof data,
            options: options ? { 
              hasHeaders: !!options.headers,
              hasParams: !!options.params,
              timeout: options.timeout
            } : undefined
          }
        };
      }
    });

    // Disconnect from a socket
    exports('socketDisconnect', (url: any, namespace: any = '/') => {
      try {
        // Try to normalise URL
        const normalisedUrl = normaliseUrl(url);
        if (!normalisedUrl) {
          const errorMsg = formatErrorMessage('Invalid URL provided for disconnection, could not normalise', String(url));
          this.logger.error(errorMsg);
          return { success: false, error: 'Invalid URL format. Expected format: http(s)://hostname[:port]' };
        }
        url = normalisedUrl;
        
        // Validate URL
        if (!isValidUrl(url)) {
          const errorMsg = formatErrorMessage('Invalid URL format after normalization', url);
          this.logger.error(errorMsg);
          return { success: false, error: 'Invalid URL format. Expected format: http(s)://hostname[:port]' };
        }

        // Validate namespace
        if (!isValidNamespace(namespace)) {
          namespace = '/'; // Default to root namespace
          this.logger.warn(`[fivem-socket.io] Invalid namespace provided for disconnection. Using default: '/'`);
        }
        
        this.logger.info(`Attempting to disconnect from ${url}${namespace}`);
        
        // Check if the connection exists before trying to disconnect
        const connectionKey = `${url}${namespace}`;
        if (!this.socketManager['connections'] || !this.socketManager['connections'].has(connectionKey)) {
          this.logger.warn(`No active connection found for ${url}${namespace}, skipping disconnect`);
          return {
            success: true,
            message: 'No active connection found to disconnect',
            url: url,
            namespace: namespace
          };
        }
        
        this.socketManager.disconnect(url, namespace);
        
        this.logger.info(`Successfully disconnected from ${url}${namespace}`);
        return { 
          success: true,
          url: url,
          namespace: namespace
        };
      } catch (error) {
        const errorMsg = formatErrorMessage(
          `Failed to disconnect: ${error.message || 'Unknown error'}`,
          url, 
          namespace
        );
        this.logger.error(errorMsg);
        this.logger.error('[fivem-socket.io] Error details:', error);
        
        return { 
          success: false, 
          error: error.message || 'Unknown disconnection error',
          details: {
            url,
            namespace
          }
        };
      }
    });

    // Disconnect from all sockets
    exports('socketDisconnectAll', () => {
      try {
        // Get connection metrics before disconnecting for logging
        const metrics = this.getConnectionMetrics();
        
        this.logger.info(`Attempting to disconnect from all sockets. Current connections: ${metrics.total}, Connected: ${metrics.connected}`);
        
        if (metrics.total > 0) {
          this.logger.debug('Connection details before disconnect:', JSON.stringify(metrics.connections, null, 2));
        }
        
        this.socketManager.disconnectAll();
        
        this.logger.info('Successfully disconnected from all sockets');
        return { 
          success: true,
          disconnectedCount: metrics.total
        };
      } catch (error) {
        const errorMsg = formatErrorMessage(
          `Failed to disconnect from all sockets: ${error.message || 'Unknown error'}`
        );
        this.logger.error(errorMsg);
        this.logger.error('[fivem-socket.io] Error details:', error);
        
        return { 
          success: false, 
          error: error.message || 'Unknown disconnection error'
        };
      }
    });
  }

  /**
   * Gets metrics about the current socket connections for debugging
   * @returns Object with connection metrics
   */
  public getConnectionMetrics(): Record<string, any> {
    try {
      // Check if connections map exists
      if (!this.socketManager['connections']) {
        return {
          total: 0,
          connections: []
        };
      }
      
      const connections: Record<string, any>[] = [];
      let totalConnected = 0;
      
      // Gather metrics for each connection
      this.socketManager['connections'].forEach((connection: any, key: string) => {
        if (connection.connected) {
          totalConnected++;
        }
        
        // Get count of event listeners
        let listenerCount = 0;
        if (connection.listeners) {
          connection.listeners.forEach((listeners: Set<any>) => {
            listenerCount += listeners.size;
          });
        }
        
        connections.push({
          key,
          url: connection.url,
          namespace: connection.namespace,
          connected: !!connection.connected,
          reconnectAttempts: connection.reconnectAttempts || 0,
          events: connection.listeners ? connection.listeners.size : 0,
          totalListeners: listenerCount
        });
      });
      
      return {
        total: this.socketManager['connections'].size,
        connected: totalConnected,
        connections
      };
      
    } catch (error) {
      this.logger.error('Failed to get connection metrics:', error);
      return { error: 'Failed to get connection metrics' };
    }
  }

  /**
   * Register FiveM event handlers
   */
  public registerEvents(): void {
    this.logger.info('Registering FiveM event handlers');
    
    // Connect to a socket via event
    onNet('socket:connect', async (url: any, namespace: any = '/', options?: any) => {
      try {
        const sourceId = source; // Store source ID for later use
        this.logger.debug(`Received connect event from source ${sourceId}`);
        
        // Validate URL
        if (!isValidUrl(url)) {
          const errorMsg = formatErrorMessage('Invalid URL provided for connection via event', String(url));
          this.logger.error(errorMsg);
          emitNet('socket:connected', sourceId, url, namespace, false, { error: 'Invalid URL format' });
          return;
        }

        // Validate namespace
        if (!isValidNamespace(namespace)) {
          namespace = '/'; // Default to root namespace
          this.logger.warn(`[fivem-socket.io] Invalid namespace provided for connection via event. Using default: '/'`);
        }
        
        // Validate options
        if (options !== undefined && !isValidOptions(options)) {
          const errorMsg = formatErrorMessage('Invalid options object for connection via event', url, namespace);
          this.logger.error(errorMsg, options);
          emitNet('socket:connected', sourceId, url, namespace, false, { error: 'Invalid options format' });
          return;
        }
        
        this.logger.info(`Attempting to connect to ${url}${namespace} via event from source ${sourceId}`);
        
        await this.socketManager.connect(url, namespace, options);
        
        this.logger.info(`Successfully connected to ${url}${namespace} via event from source ${sourceId}`);
        emitNet('socket:connected', sourceId, url, namespace, true);
      } catch (error) {
        const errorMsg = formatErrorMessage(
          `Failed to connect via event: ${error.message || 'Unknown error'}`,
          url, 
          namespace
        );
        this.logger.error(errorMsg);
        this.logger.error('[fivem-socket.io] Error details:', error);
        
        emitNet('socket:connected', source, url, namespace, false, { 
          error: error.message || 'Unknown connection error',
          details: { url, namespace, options }
        });
      }
    });

    // Subscribe to an event via event
    onNet('socket:subscribe', async (url: any, namespace: any = '/', event: any, callbackEvent: any, options?: any) => {
      try {
        const sourceId = source; // Store source ID for later use
        this.logger.debug(`Received subscribe event from source ${sourceId}`);
        
        // Validate URL
        if (!isValidUrl(url)) {
          const errorMsg = formatErrorMessage('Invalid URL provided for subscription via event', String(url));
          this.logger.error(errorMsg);
          emitNet('socket:subscribed', sourceId, url, namespace, event, false, { error: 'Invalid URL format' });
          return;
        }

        // Validate namespace
        if (!isValidNamespace(namespace)) {
          namespace = '/'; // Default to root namespace
          this.logger.warn(`Invalid namespace provided for subscription via event. Using default: '/'`);
        }
        
        // Validate event
        if (!isValidEvent(event)) {
          const errorMsg = formatErrorMessage('Invalid event name provided for subscription via event', url, namespace);
          this.logger.error(errorMsg);
          emitNet('socket:subscribed', sourceId, url, namespace, event, false, { error: 'Invalid event name' });
          return;
        }
        
        // Validate callback event
        if (!callbackEvent || typeof callbackEvent !== 'string') {
          const errorMsg = formatErrorMessage('Invalid callback event name provided for subscription via event', url, namespace, event);
          this.logger.error(errorMsg);
          emitNet('socket:subscribed', sourceId, url, namespace, event, false, { error: 'Invalid callback event name' });
          return;
        }
        
        // Validate options
        if (options !== undefined && !isValidOptions(options)) {
          const errorMsg = formatErrorMessage('Invalid options object for subscription via event', url, namespace, event);
          this.logger.error(errorMsg, options);
          emitNet('socket:subscribed', sourceId, url, namespace, event, false, { error: 'Invalid options format' });
          return;
        }
        
        this.logger.info(`Attempting to subscribe to event '${event}' on ${url}${namespace} via event from source ${sourceId}`);
        
        await this.socketManager.subscribe(url, namespace, event, (data) => {
          try {
            // Trigger a FiveM event when the socket event is received
            this.logger.debug(`Received event '${event}' on ${url}${namespace}, broadcasting to '${callbackEvent}'`);
            
            // Check if data is valid
            if (data === undefined) {
              data = null; // Use null instead of undefined for consistency in Lua
            }
            
            this.safeEmit(callbackEvent, -1, data); // -1 broadcasts to all clients
            // Also emit a server-only event
            this.safeEmit(`socket:${callbackEvent}`, 'server', data);
          } catch (emitError) {
            this.logger.error(`Failed to emit event '${callbackEvent}':`, emitError);
          }
        }, options);
        
        this.logger.info(`Successfully subscribed to event '${event}' on ${url}${namespace} via event from source ${sourceId}`);
        emitNet('socket:subscribed', sourceId, url, namespace, event, true);
      } catch (error) {
        const errorMsg = formatErrorMessage(
          `Failed to subscribe to event via event: ${error.message || 'Unknown error'}`,
          url, 
          namespace,
          event
        );
        this.logger.error(errorMsg);
        this.logger.error('[fivem-socket.io] Error details:', error);
        
        emitNet('socket:subscribed', source, url, namespace, event, false, { 
          error: error.message || 'Unknown subscription error',
          details: { url, namespace, event, callbackEvent, options }
        });
      }
    });

    // Publish an event via event
    onNet('socket:publish', async (url: any, namespace: any = '/', event: any, data: any, options?: any) => {
      try {
        const sourceId = source; // Store source ID for later use
        this.logger.debug(`Received publish event from source ${sourceId}`);
        
        // Validate URL
        if (!isValidUrl(url)) {
          const errorMsg = formatErrorMessage('Invalid URL provided for publishing via event', String(url));
          this.logger.error(errorMsg);
          emitNet('socket:published', sourceId, url, namespace, event, false, { error: 'Invalid URL format' });
          return;
        }

        // Validate namespace
        if (!isValidNamespace(namespace)) {
          namespace = '/'; // Default to root namespace
          this.logger.warn(`[fivem-socket.io] Invalid namespace provided for publishing via event. Using default: '/'`);
        }
        
        // Validate event
        if (!isValidEvent(event)) {
          const errorMsg = formatErrorMessage('Invalid event name provided for publishing via event', url, namespace);
          this.logger.error(errorMsg);
          emitNet('socket:published', sourceId, url, namespace, event, false, { error: 'Invalid event name' });
          return;
        }
        
        // Validate data (we accept any data but want to make sure it's defined)
        if (data === undefined) {
          this.logger.warn(`Undefined data provided for event '${event}' via event. Using null instead.`);
          data = null;
        }
        
        // Validate options
        if (options !== undefined && !isValidOptions(options)) {
          const errorMsg = formatErrorMessage('Invalid options object for publishing via event', url, namespace, event);
          this.logger.error(errorMsg, options);
          emitNet('socket:published', sourceId, url, namespace, event, false, { error: 'Invalid options format' });
          return;
        }
        
        this.logger.debug(`Attempting to publish event '${event}' to ${url}${namespace} via event from source ${sourceId}`);
        
        await this.socketManager.publish(url, namespace, event, data, options);
        
        this.logger.info(`Successfully published event '${event}' to ${url}${namespace} via event from source ${sourceId}`);
        emitNet('socket:published', sourceId, url, namespace, event, true);
      } catch (error) {
        const errorMsg = formatErrorMessage(
          `Failed to publish event via event: ${error.message || 'Unknown error'}`,
          url, 
          namespace,
          event
        );
        this.logger.error(errorMsg);
        this.logger.error('[fivem-socket.io] Error details:', error);
        
        emitNet('socket:published', source, url, namespace, event, false, { 
          error: error.message || 'Unknown publish error',
          details: { url, namespace, event, dataType: typeof data, options }
        });
      }
    });

    // Unsubscribe from an event via event
    onNet('socket:unsubscribe', (url: any, namespace: any = '/', event: any, options?: any) => {
      try {
        const sourceId = source; // Store source ID for later use
        this.logger.debug(`Received unsubscribe event from source ${sourceId}`);
        
        // Validate URL
        if (!isValidUrl(url)) {
          const errorMsg = formatErrorMessage('Invalid URL provided for unsubscription via event', String(url));
          this.logger.error(errorMsg);
          emitNet('socket:unsubscribed', sourceId, url, namespace, event, false, { error: 'Invalid URL format' });
          return;
        }

        // Validate namespace
        if (!isValidNamespace(namespace)) {
          namespace = '/'; // Default to root namespace
          this.logger.warn(`[fivem-socket.io] Invalid namespace provided for unsubscription via event. Using default: '/'`);
        }
        
        // Validate event
        if (!isValidEvent(event)) {
          const errorMsg = formatErrorMessage('Invalid event name provided for unsubscription via event', url, namespace);
          this.logger.error(errorMsg);
          emitNet('socket:unsubscribed', sourceId, url, namespace, event, false, { error: 'Invalid event name' });
          return;
        }
        
        // Validate options
        if (options !== undefined && !isValidOptions(options)) {
          const errorMsg = formatErrorMessage('Invalid options object for unsubscription via event', url, namespace, event);
          this.logger.error(errorMsg, options);
          emitNet('socket:unsubscribed', sourceId, url, namespace, event, false, { error: 'Invalid options format' });
          return;
        }
        
        this.logger.debug(`Attempting to unsubscribe from event '${event}' on ${url}${namespace} via event from source ${sourceId}`);
        
        this.socketManager.unsubscribe(url, namespace, event, undefined, options);
        
        this.logger.info(`Successfully unsubscribed from event '${event}' on ${url}${namespace} via event from source ${sourceId}`);
        emitNet('socket:unsubscribed', sourceId, url, namespace, event, true);
      } catch (error) {
        const errorMsg = formatErrorMessage(
          `Failed to unsubscribe from event via event: ${error.message || 'Unknown error'}`,
          url, 
          namespace,
          event
        );
        this.logger.error(errorMsg);
        this.logger.error('[fivem-socket.io] Error details:', error);
        
        emitNet('socket:unsubscribed', source, url, namespace, event, false, { 
          error: error.message || 'Unknown unsubscription error',
          details: { url, namespace, event, options }
        });
      }
    });

    // Disconnect from a socket via event
    onNet('socket:disconnect', (url: any, namespace: any = '/') => {
      try {
        const sourceId = source; // Store source ID for later use
        this.logger.debug(`Received disconnect event from source ${sourceId}`);
        
        // Validate URL
        if (!isValidUrl(url)) {
          const errorMsg = formatErrorMessage('Invalid URL provided for disconnection via event', String(url));
          this.logger.error(errorMsg);
          emitNet('socket:disconnected', sourceId, url, namespace, false, { error: 'Invalid URL format' });
          return;
        }

        // Validate namespace
        if (!isValidNamespace(namespace)) {
          namespace = '/'; // Default to root namespace
          this.logger.warn(`[fivem-socket.io] Invalid namespace provided for disconnection via event. Using default: '/'`);
        }
        
        this.logger.debug(`Attempting to disconnect from ${url}${namespace} via event from source ${sourceId}`);
        
        this.socketManager.disconnect(url, namespace);
        
        this.logger.info(`Successfully disconnected from ${url}${namespace} via event from source ${sourceId}`);
        emitNet('socket:disconnected', sourceId, url, namespace, true);
      } catch (error) {
        const errorMsg = formatErrorMessage(
          `Failed to disconnect via event: ${error.message || 'Unknown error'}`,
          url, 
          namespace
        );
        this.logger.error(errorMsg);
        this.logger.error('[fivem-socket.io] Error details:', error);
        
        emitNet('socket:disconnected', source, url, namespace, false, { 
          error: error.message || 'Unknown disconnection error',
          details: { url, namespace }
        });
      }
    });

    // Disconnect from all sockets via event
    onNet('socket:disconnectAll', () => {
      try {
        const sourceId = source; // Store source ID for later use
        this.logger.debug(`Received disconnectAll event from source ${sourceId}`);
        
        this.logger.debug(`Attempting to disconnect from all sockets via event from source ${sourceId}`);
        
        this.socketManager.disconnectAll();
        
        this.logger.info(`Successfully disconnected from all sockets via event from source ${sourceId}`);
        emitNet('socket:disconnectedAll', sourceId, true);
      } catch (error) {
        const errorMsg = formatErrorMessage(
          `Failed to disconnect from all sockets via event: ${error.message || 'Unknown error'}`
        );
        this.logger.error(errorMsg);
        this.logger.error('[fivem-socket.io] Error details:', error);
        
        emitNet('socket:disconnectedAll', source, false, { 
          error: error.message || 'Unknown disconnection error'
        });
      }
    });
  }
}
