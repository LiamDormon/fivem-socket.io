/**
 * Sanitisation utilities for FiveM Socket.io library
 */

/**
 * Sanitises and validates user input data
 * @param data Any user input data
 * @returns Sanitised data safe for use
 */
export function sanitiseData(data: any): any {
  // Handle undefined or null
  if (data === undefined || data === null) {
    return null;
  }
  
  // For objects and arrays, sanitise recursively
  if (typeof data === 'object') {
    if (Array.isArray(data)) {
      return data.map(item => sanitiseData(item));
    } else {
      const sanitised: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        // Skip functions, symbols, etc.
        if (typeof value !== 'function' && typeof value !== 'symbol') {
          sanitised[key] = sanitiseData(value);
        }
      }
      return sanitised;
    }
  }
  
  // For strings, prevent possibly malicious content
  if (typeof data === 'string') {
    // Basic sanitisation to prevent script injection
    // In a real implementation, you might want a more comprehensive approach
    return data
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  
  // Safe types like numbers, booleans
  return data;
}
