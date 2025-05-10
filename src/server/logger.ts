import { createLogger, format, transports, Logger as WinstonLogger } from 'winston';
import { singleton } from 'tsyringe';

/**
 * Logger class for fivem-socket.io
 * Uses winston for logging with configurable log levels
 */
@singleton()
export class Logger {
  private logger: WinstonLogger;
  private readonly DEFAULT_LOG_LEVEL = 'info';
  private readonly PREFIX = '[fivem-socket.io]';

  constructor() {
    const consoleLogLevel = this.getConfiguredLogLevel();
    
    this.logger = createLogger({
      level: consoleLogLevel,
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(({ level, message, timestamp }) => {
          return `${timestamp} ${this.PREFIX} ${level.toUpperCase()}: ${message}`;
        })
      ),
      transports: [
        new transports.Console()
      ]
    });

    this.info(`Logger initialized with level: ${consoleLogLevel}`);
  }

  /**
   * Get the configured log level from FiveM resource metadata
   * @returns The configured log level or default if not set
   */
  private getConfiguredLogLevel(): string {
    try {
      const configuredLevel = GetResourceMetadata(GetCurrentResourceName(), 'console_log_level', 0);
      const validLevels = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];
      
      if (configuredLevel && validLevels.includes(configuredLevel.toLowerCase())) {
        return configuredLevel.toLowerCase();
      }
      
      return this.DEFAULT_LOG_LEVEL;
    } catch (error) {
      // If there's an error reading the metadata, fallback to default
      return this.DEFAULT_LOG_LEVEL;
    }
  }

  /**
   * Log an error message
   * @param message Message to log
   * @param meta Optional metadata
   */
  public error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }

  /**
   * Log a warning message
   * @param message Message to log
   * @param meta Optional metadata
   */
  public warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  /**
   * Log an info message
   * @param message Message to log
   * @param meta Optional metadata
   */
  public info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  /**
   * Log a debug message
   * @param message Message to log
   * @param meta Optional metadata
   */
  public debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  /**
   * Log a verbose message
   * @param message Message to log
   * @param meta Optional metadata
   */
  public verbose(message: string, meta?: any): void {
    this.logger.verbose(message, meta);
  }
}
