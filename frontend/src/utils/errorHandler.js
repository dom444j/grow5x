/**
 * Error Handler Utility
 * Provides consistent error handling and toast notifications across the application
 */

import { toast } from 'react-hot-toast';

/**
 * Maps HTTP status codes to user-friendly error messages
 */
const ERROR_MESSAGES = {
  400: 'Error de validación en los datos enviados',
  401: 'Sesión expirada. Redirigiendo al login...',
  403: 'No tienes permisos para realizar esta acción',
  404: 'El recurso solicitado no fue encontrado',
  409: 'Conflicto: el recurso ya existe o está en uso',
  422: 'Los datos enviados no son válidos',
  429: 'Demasiadas solicitudes. Intenta nuevamente en unos minutos',
  500: 'Error interno del servidor. Intenta nuevamente',
  502: 'Servicio temporalmente no disponible',
  503: 'Servicio en mantenimiento. Intenta más tarde',
  504: 'Tiempo de espera agotado. Verifica tu conexión'
};

/**
 * Maps specific error codes to user-friendly messages
 */
const ERROR_CODE_MESSAGES = {
  'VALIDATION_ERROR': 'Error de validación en los datos',
  'UNAUTHORIZED': 'Sesión expirada',
  'FORBIDDEN': 'Acceso denegado',
  'RATE_LIMIT_EXCEEDED': 'Demasiadas solicitudes. Espera un momento',
  'INTERNAL_ERROR': 'Error interno del servidor',
  'NETWORK_ERROR': 'Error de conexión. Verifica tu internet',
  'TIMEOUT_ERROR': 'Tiempo de espera agotado',
  'INVALID_TOKEN': 'Token de sesión inválido',
  'TOKEN_EXPIRED': 'Sesión expirada',
  'INSUFFICIENT_PERMISSIONS': 'Permisos insuficientes',
  'RESOURCE_NOT_FOUND': 'Recurso no encontrado',
  'DUPLICATE_RESOURCE': 'El recurso ya existe',
  'INVALID_CREDENTIALS': 'Credenciales inválidas',
  'ACCOUNT_LOCKED': 'Cuenta bloqueada temporalmente',
  'INVALID_OTP': 'PIN incorrecto o expirado',
  'OTP_EXPIRED': 'PIN expirado. Solicita uno nuevo',
  'OTP_ATTEMPTS_EXCEEDED': 'Demasiados intentos. Espera antes de solicitar un nuevo PIN'
};

/**
 * Extracts error message from API response
 * @param {Error} error - The error object
 * @returns {string} User-friendly error message
 */
export const getErrorMessage = (error) => {
  // Network error
  if (!error.response) {
    if (error.code === 'NETWORK_ERROR' || error.message === 'Network Error') {
      return 'Error de conexión. Verifica tu internet';
    }
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return 'Tiempo de espera agotado. Intenta nuevamente';
    }
    return error.message || 'Error de conexión inesperado';
  }

  const { status, data } = error.response;
  
  // Use specific error code message if available
  if (data?.code && ERROR_CODE_MESSAGES[data.code]) {
    return ERROR_CODE_MESSAGES[data.code];
  }
  
  // Use API message if available
  if (data?.message) {
    return data.message;
  }
  
  // Use status code message
  if (ERROR_MESSAGES[status]) {
    return ERROR_MESSAGES[status];
  }
  
  return 'Error inesperado. Intenta nuevamente';
};

/**
 * Handles API errors with consistent toast notifications
 * @param {Error} error - The error object
 * @param {Function} logoutCallback - Function to call for auth errors
 * @returns {boolean} True if error was handled (auth error), false otherwise
 */
export const handleApiError = (error, logoutCallback = null) => {
  const status = error.response?.status;
  const message = getErrorMessage(error);
  
  switch (status) {
    case 400:
      toast.error(`Validación: ${message}`);
      break;
      
    case 401:
    case 403:
      toast.error(message);
      if (logoutCallback) {
        setTimeout(() => {
          logoutCallback();
          window.location.href = '/login';
        }, 1500);
      }
      return true; // Indicates auth error was handled
      
    case 404:
      toast.error(message);
      break;
      
    case 409:
      toast.error(`Conflicto: ${message}`);
      break;
      
    case 422:
      toast.error(`Datos inválidos: ${message}`);
      break;
      
    case 429:
      toast.error(message, { duration: 6000 });
      break;
      
    case 500:
    case 502:
    case 503:
    case 504:
      toast.error(message, { duration: 4000 });
      break;
      
    default:
      toast.error(message);
  }
  
  return false;
};

/**
 * Handles validation errors specifically
 * @param {Error} error - The error object
 * @returns {Object} Formatted validation errors
 */
export const handleValidationErrors = (error) => {
  const errors = {};
  
  if (error.response?.data?.errors) {
    // Handle array of validation errors
    error.response.data.errors.forEach(err => {
      if (err.field) {
        errors[err.field] = err.message;
      }
    });
  } else if (error.response?.data?.message) {
    // Handle single validation error
    errors.general = error.response.data.message;
  } else {
    errors.general = getErrorMessage(error);
  }
  
  return errors;
};

/**
 * Creates a standardized error object
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @param {number} status - HTTP status code
 * @returns {Error} Standardized error object
 */
export const createError = (message, code = 'UNKNOWN_ERROR', status = 500) => {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
};

/**
 * Logs errors for debugging purposes
 * @param {Error} error - The error object
 * @param {string} context - Context where error occurred
 */
export const logError = (error, context = 'Unknown') => {
  if (process.env.NODE_ENV === 'development') {
    console.group(`🚨 Error in ${context}`);
    console.error('Message:', error.message);
    console.error('Status:', error.response?.status);
    console.error('Code:', error.response?.data?.code || error.code);
    console.error('Full Error:', error);
    console.groupEnd();
  }
};

/**
 * Retry mechanism for failed requests
 * @param {Function} requestFn - Function that makes the request
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delay - Delay between retries in ms
 * @returns {Promise} Request result
 */
export const retryRequest = async (requestFn, maxRetries = 3, delay = 1000) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx) including 429 (rate limiting)
      const status = error.response?.status;
      if (status >= 400 && status < 500) {
        throw error;
      }
      
      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  throw lastError;
};

export default {
  getErrorMessage,
  handleApiError,
  handleValidationErrors,
  createError,
  logError,
  retryRequest
};