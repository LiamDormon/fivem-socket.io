import 'reflect-metadata';
import { container } from './container';
import { SocketManager } from './socket/SocketManager';
import { FiveMSocketAdapter } from './socket/FiveMSocketAdapter';
import { Logger } from './logger';

// Get instances from the DI container
const logger = container.resolve(Logger);
const socketManager = container.resolve(SocketManager);
const fivemSocketAdapter = container.resolve(FiveMSocketAdapter);


logger.info('Socket.io wrapper initialized');

// Clean up socket connections when the resource stops
on('onResourceStop', (resourceName: string) => {
  if (resourceName === GetCurrentResourceName()) {
    logger.info('Resource stopping, cleaning up socket connections');
    socketManager.disconnectAll();
  }
});