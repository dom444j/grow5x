/**
 * Authentication Middleware
 * Handles JWT token validation and user authentication
 */

const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../config/logger');

/**
 * JWT Authentication Middleware
 * Validates JWT token and attaches user to request
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Try to get token from cookie first, then from Authorization header
    const cookieToken = req.cookies?.access_token;
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    const token = cookieToken || bearerToken;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de acceso requerido',
        code: 'TOKEN_REQUIRED'
      });
    }
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user by custom userId field
    const user = await User.findOne({ userId: decoded.userId }).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Cuenta desactivada',
        code: 'ACCOUNT_DISABLED'
      });
    }
    
    // Check if user is verified (if verification is required)
    if (process.env.REQUIRE_EMAIL_VERIFICATION === 'true' && !user.isVerified) {
      return res.status(401).json({
        success: false,
        message: 'Cuenta no verificada',
        code: 'ACCOUNT_NOT_VERIFIED'
      });
    }
    
    // Check token version for session invalidation
    const tokenVersion = decoded.tokenVersion || 0;
    const userTokenVersion = user.tokenVersion || 0;
    
    if (tokenVersion !== userTokenVersion) {
      return res.status(401).json({
        success: false,
        message: 'Sesión invalidada. Por favor, inicia sesión nuevamente',
        code: 'TOKEN_INVALIDATED'
      });
    }
    
    // Attach user to request
    req.user = user;
    req.userId = user.userId; // Keep userId for requireAdmin middleware
    
    // Log successful authentication
    logger.debug('User authenticated successfully', {
      userId: user.userId,
      email: user.email,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    next();
    
  } catch (error) {
    logger.error('Authentication error:', {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Import the unified requireAdmin middleware
const requireAdmin = require('./requireAdmin');

/**
 * Optional Authentication Middleware
 * Attaches user to request if token is provided, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    // Try to get token from cookie first, then from Authorization header
    const cookieToken = req.cookies?.access_token;
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.split(' ')[1];
    
    const token = cookieToken || bearerToken;
    
    if (!token) {
      // No token provided, continue without user
      return next();
    }
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user by userId field (not MongoDB _id)
    const user = await User.findOne({ userId: decoded.userId }).select('-password');
    
    if (user && user.isActive) {
      req.user = user;
      req.userId = user._id;
    }
    
    next();
    
  } catch (error) {
    // If token is invalid, continue without user (don't throw error)
    logger.debug('Optional auth failed, continuing without user', {
      error: error.message,
      ip: req.ip
    });
    
    next();
  }
};

/**
 * Generate JWT Token
 * Creates a new JWT token for the user
 */
const generateToken = (user) => {
  const payload = {
    userId: user.userId,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion || 0
  };
  
  const options = {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    issuer: 'grow5x-api',
    audience: 'grow5x-client'
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, options);
};

/**
 * Verify JWT Token
 * Verifies a JWT token and returns the decoded payload
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error(`Token verification failed: ${error.message}`);
  }
};

/**
 * Extract User ID from Token
 * Extracts user ID from JWT token without full verification
 */
const extractUserIdFromToken = (token) => {
  try {
    const decoded = jwt.decode(token);
    return decoded?.userId || null;
  } catch (error) {
    return null;
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  optionalAuth,
  generateToken,
  verifyToken,
  extractUserIdFromToken
};