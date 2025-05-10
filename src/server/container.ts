import 'reflect-metadata';
import { container } from 'tsyringe';
import { SocketManager } from './socket/SocketManager';
import { FiveMSocketAdapter } from './socket/FiveMSocketAdapter';
import { Logger } from './logger';

// Configure container
container.registerSingleton('Logger', Logger);
container.registerSingleton('SocketManager', SocketManager);
container.registerSingleton('FiveMSocketAdapter', FiveMSocketAdapter);

export { container };
