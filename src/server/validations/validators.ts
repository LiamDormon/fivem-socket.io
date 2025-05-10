/**
 * Validation utilities for FiveM Socket.io library
 */

/**
 * Validates a URL string
 * @param url The URL to validate
 * @returns True if the URL is valid, false otherwise
 */
export function isValidUrl(url: any): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  try {
    // Check if URL is parsable
    const urlObj = new URL(url);
    return !!urlObj.hostname;
  } catch (e) {
    return false;
  }
}

/**
 * Validates a namespace string
 * @param namespace The namespace to validate
 * @returns True if the namespace is valid, false otherwise
 */
export function isValidNamespace(namespace: any): boolean {
  // Namespace must be a string
  if (typeof namespace !== 'string') {
    return false;
  }
  
  // Namespace should start with '/' and not contain invalid characters
  return namespace.startsWith('/') && !namespace.includes(' ');
}

/**
 * Validates an event name
 * @param event The event name to validate
 * @returns True if the event name is valid, false otherwise
 */
export function isValidEvent(event: any): boolean {
  return typeof event === 'string' && event.length > 0;
}

/**
 * Validates options object
 * @param options The options object to validate
 * @returns True if the options are valid, false otherwise
 */
export function isValidOptions(options: any): boolean {
  if (!options) {
    return true; // No options is fine
  }
  
  if (typeof options !== 'object') {
    return false;
  }
  
  // Check if any of the options have incorrect types
  if (options.reconnectionAttempts !== undefined && typeof options.reconnectionAttempts !== 'number') {
    return false;
  }
  
  if (options.reconnectionDelay !== undefined && typeof options.reconnectionDelay !== 'number') {
    return false;
  }
  
  if (options.timeout !== undefined && typeof options.timeout !== 'number') {
    return false;
  }
  
  if (options.autoConnect !== undefined && typeof options.autoConnect !== 'boolean') {
    return false;
  }
  
  if (options.headers !== undefined && typeof options.headers !== 'object') {
    return false;
  }
  
  if (options.params !== undefined && typeof options.params !== 'object') {
    return false;
  }
  
  return true;
}

/**
 * Formats an error message with additional context
 * @param message The error message
 * @param url The URL associated with the error
 * @param namespace The namespace associated with the error
 * @param event Optional event name associated with the error
 * @returns Formatted error message
 */
export function formatErrorMessage(message: string, url?: string, namespace?: string, event?: string): string {
  let formatted = `[fivem-socket.io] ERROR: ${message}`;
  
  if (url) {
    formatted += ` | URL: ${url}`;
  }
  
  if (namespace) {
    formatted += ` | Namespace: ${namespace}`;
  }
  
  if (event) {
    formatted += ` | Event: ${event}`;
  }
  
  return formatted;
}

/**
 * Attempts to normalize and fix broken URLs
 * @param url The URL to normalize
 * @returns A normalized URL or null if can't be fixed
 */
export function normaliseUrl(url: any): string | null {
  if (!url) {
    return null;
  }
  
  if (typeof url !== 'string') {
    url = String(url);
  }
  
  // Try to fix common URL issues
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('ws://') && !url.startsWith('wss://')) {
    url = 'http://' + url;
  }
  
  try {
    // Validate by parsing
    const parsedUrl = new URL(url).toString();
    return parsedUrl.substring(0, parsedUrl.length - 1); // Remove trailing slash
  } catch (e) {
    return null;
  }
}
