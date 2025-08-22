/**
 * Response Standardizer Middleware
 * Ensures consistent API response format across all endpoints
 * Handles data transformation and error formatting
 */

const logger = require('../config/logger');
const { toApiNumber } = require('../utils/decimal');

/**
 * Standard API response format
 * {
 *   success: boolean,
 *   data?: any,
 *   message?: string,
 *   code?: string,
 *   timestamp: string,
 *   requestId?: string
 * }
 */

class ResponseStandardizer {
  constructor() {
    this.transformers = new Map();
    this.setupDefaultTransformers();
  }

  /**
   * Setup default data transformers
   */
  setupDefaultTransformers() {
    // Transform Decimal128 to numbers
    this.addTransformer('decimal128', (value) => {
      if (value && typeof value.toString === 'function') {
        return toApiNumber(parseFloat(value.toString()));
      }
      return value;
    });

    // Transform ObjectId to string
    this.addTransformer('objectId', (value) => {
      if (value && typeof value.toString === 'function') {
        return value.toString();
      }
      return value;
    });

    // Transform Date to ISO string
    this.addTransformer('date', (value) => {
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    });
  }

  /**
   * Add custom data transformer
   * @param {string} name - Transformer name
   * @param {Function} transformer - Transformer function
   */
  addTransformer(name, transformer) {
    this.transformers.set(name, transformer);
  }

  /**
   * Transform data recursively
   * @param {any} data - Data to transform
   * @returns {any} - Transformed data
   */
  transformData(data) {
    if (data === null || data === undefined) {
      return data;
    }

    // Handle arrays
    if (Array.isArray(data)) {
      return data.map(item => this.transformData(item));
    }

    // Handle objects
    if (typeof data === 'object') {
      // Handle Mongoose Decimal128
      if (data.constructor && data.constructor.name === 'Decimal128') {
        return this.transformers.get('decimal128')(data);
      }

      // Handle ObjectId
      if (data.constructor && data.constructor.name === 'ObjectId') {
        return this.transformers.get('objectId')(data);
      }

      // Handle Date
      if (data instanceof Date) {
        return this.transformers.get('date')(data);
      }

      // Handle plain objects
      const transformed = {};
      for (const [key, value] of Object.entries(data)) {
        transformed[key] = this.transformData(value);
      }
      return transformed;
    }

    return data;
  }

  /**
   * Create standardized success response
   * @param {any} data - Response data
   * @param {string} message - Success message
   * @param {Object} options - Additional options
   * @returns {Object} - Standardized response
   */
  createSuccessResponse(data, message = null, options = {}) {
    const response = {
      success: true,
      timestamp: new Date().toISOString()
    };

    if (data !== undefined) {
      response.data = this.transformData(data);
    }

    if (message) {
      response.message = message;
    }

    if (options.requestId) {
      response.requestId = options.requestId;
    }

    if (options.pagination) {
      response.pagination = options.pagination;
    }

    if (options.meta) {
      response.meta = options.meta;
    }

    return response;
  }

  /**
   * Create standardized error response
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {Object} options - Additional options
   * @returns {Object} - Standardized error response
   */
  createErrorResponse(message, code = 'INTERNAL_ERROR', options = {}) {
    const response = {
      success: false,
      message,
      code,
      timestamp: new Date().toISOString()
    };

    if (options.requestId) {
      response.requestId = options.requestId;
    }

    if (options.details && process.env.NODE_ENV === 'development') {
      response.details = options.details;
    }

    if (options.field) {
      response.field = options.field;
    }

    return response;
  }

  /**
   * Middleware to standardize responses
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @param {Function} next - Next middleware
   */
  middleware() {
    return (req, res, next) => {
      // Generate request ID for tracking
      req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Override res.json to standardize responses
      const originalJson = res.json.bind(res);
      
      res.json = (data) => {
        // If data is already standardized (has success field), send as-is
        if (data && typeof data === 'object' && 'success' in data) {
          if (!data.timestamp) {
            data.timestamp = new Date().toISOString();
          }
          if (!data.requestId) {
            data.requestId = req.requestId;
          }
          return originalJson(data);
        }

        // Standardize the response
        const standardized = this.createSuccessResponse(data, null, {
          requestId: req.requestId
        });
        
        return originalJson(standardized);
      };

      // Add helper methods to response object
      res.success = (data, message, options = {}) => {
        const response = this.createSuccessResponse(data, message, {
          requestId: req.requestId,
          ...options
        });
        return res.json(response);
      };

      res.error = (message, code = 'INTERNAL_ERROR', statusCode = 500, options = {}) => {
        const response = this.createErrorResponse(message, code, {
          requestId: req.requestId,
          ...options
        });
        return res.status(statusCode).json(response);
      };

      res.validationError = (message, field = null) => {
        return res.error(message, 'VALIDATION_ERROR', 400, { field });
      };

      res.notFound = (message = 'Resource not found') => {
        return res.error(message, 'NOT_FOUND', 404);
      };

      res.unauthorized = (message = 'Unauthorized access') => {
        return res.error(message, 'UNAUTHORIZED', 401);
      };

      res.forbidden = (message = 'Access forbidden') => {
        return res.error(message, 'FORBIDDEN', 403);
      };

      res.conflict = (message = 'Resource conflict') => {
        return res.error(message, 'CONFLICT', 409);
      };

      res.tooManyRequests = (message = 'Too many requests') => {
        return res.error(message, 'TOO_MANY_REQUESTS', 429);
      };

      next();
    };
  }

  /**
   * Error handler middleware
   * @param {Error} err - Error object
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @param {Function} next - Next middleware
   */
  errorHandler() {
    return (err, req, res, next) => {
      // Log error
      logger.error('Unhandled error:', {
        error: err.message,
        stack: err.stack,
        requestId: req.requestId,
        url: req.url,
        method: req.method,
        userId: req.user?.userId,
        ip: req.ip
      });

      // Handle specific error types
      if (err.name === 'ValidationError') {
        const field = Object.keys(err.errors)[0];
        const message = err.errors[field]?.message || 'Validation error';
        return res.validationError(message, field);
      }

      if (err.name === 'CastError') {
        return res.validationError('Invalid ID format', err.path);
      }

      if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.conflict(`${field} already exists`);
      }

      if (err.name === 'JsonWebTokenError') {
        return res.unauthorized('Invalid token');
      }

      if (err.name === 'TokenExpiredError') {
        return res.unauthorized('Token expired');
      }

      // Handle Zod validation errors
      if (err.name === 'ZodError') {
        const firstError = err.errors[0];
        const field = firstError.path.join('.');
        return res.validationError(firstError.message, field);
      }

      // Default error response
      const statusCode = err.statusCode || err.status || 500;
      const message = statusCode === 500 ? 'Internal server error' : err.message;
      const code = err.code || 'INTERNAL_ERROR';

      return res.error(message, code, statusCode, {
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    };
  }

  /**
   * Cache response with standardized format
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {number} ttl - Time to live in seconds
   * @returns {Object} - Standardized cached response
   */
  createCachedResponse(key, data, ttl) {
    const response = this.createSuccessResponse(data, null, {
      meta: {
        cached: true,
        cacheKey: key,
        ttl,
        cachedAt: new Date().toISOString()
      }
    });

    return response;
  }

  /**
   * Create paginated response
   * @param {Array} data - Data array
   * @param {Object} pagination - Pagination info
   * @param {string} message - Success message
   * @returns {Object} - Standardized paginated response
   */
  createPaginatedResponse(data, pagination, message = null) {
    return this.createSuccessResponse(data, message, {
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        pages: Math.ceil(pagination.total / pagination.limit),
        hasNext: pagination.page < Math.ceil(pagination.total / pagination.limit),
        hasPrev: pagination.page > 1
      }
    });
  }
}

// Export singleton instance
const responseStandardizer = new ResponseStandardizer();

module.exports = {
  ResponseStandardizer,
  responseStandardizer,
  middleware: responseStandardizer.middleware(),
  errorHandler: responseStandardizer.errorHandler()
};