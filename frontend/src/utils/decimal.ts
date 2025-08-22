/**
 * Utility functions for handling MongoDB Decimal128 values
 * Converts {$numberDecimal: "value"} objects to JavaScript numbers
 */

/**
 * Converts a MongoDB Decimal128 object to a JavaScript number
 * @param value - The value that might be a Decimal128 object or a regular number
 * @returns The numeric value as a JavaScript number
 */
export function parseDecimal(value: any): number {
  // If it's already a number, return it
  if (typeof value === 'number') {
    return value;
  }
  
  // If it's a string, parse it
  if (typeof value === 'string') {
    return parseFloat(value);
  }
  
  // If it's a MongoDB Decimal128 object
  if (value && typeof value === 'object' && value.$numberDecimal) {
    return parseFloat(value.$numberDecimal);
  }
  
  // If it's null or undefined, return 0
  if (value == null) {
    return 0;
  }
  
  // Try to convert to number as fallback
  const parsed = Number(value);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Formats a decimal value for display with specified decimal places
 * @param value - The value to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string
 */
export function formatDecimal(value: any, decimals: number = 2): string {
  const numValue = parseDecimal(value);
  return numValue.toFixed(decimals);
}

/**
 * Safely converts any value to a number for React rendering
 * @param value - The value to convert
 * @returns A number that React can safely render
 */
export function toRenderableNumber(value: any): number {
  return parseDecimal(value);
}

/**
 * Recursively processes an object to convert all Decimal128 values to numbers
 * @param obj - The object to process
 * @returns The processed object with converted decimal values
 */
export function processDecimalFields(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(processDecimalFields);
  }
  
  if (typeof obj === 'object') {
    // Check if it's a Decimal128 object
    if (obj.$numberDecimal) {
      return parseDecimal(obj);
    }
    
    // Process all properties recursively
    const processed: any = {};
    for (const [key, value] of Object.entries(obj)) {
      processed[key] = processDecimalFields(value);
    }
    return processed;
  }
  
  return obj;
}