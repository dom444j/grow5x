/**
 * Authentication Routes
 * Handles user registration, login, and profile management
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const { User, SpecialCode } = require('../models');
const { authenticateToken, generateToken } = require('../middleware/auth');
const logger = require('../config/logger');

const router = express.Router();

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    message: 'Demasiados intentos de autenticación. Intenta de nuevo en 15 minutos.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  firstName: z.string().min(1, 'Nombre es requerido').max(50, 'Nombre muy largo'),
  lastName: z.string().min(1, 'Apellido es requerido').max(50, 'Apellido muy largo'),
  phone: z.string().min(10, 'Teléfono inválido').max(20, 'Teléfono muy largo'),
  country: z.string().min(2, 'País es requerido').max(50, 'País muy largo'),
  referralCode: z.string().min(1, 'Código de referido es requerido'),
  telegramUsername: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña es requerida')
});

/**
 * POST /api/auth/register
 * Register a new user with referral code
 */
router.post('/register', authLimiter, async (req, res) => {
  try {
    // Validate request body
    const validatedData = registerSchema.parse(req.body);
    
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      country,
      referralCode,
      telegramUsername
    } = validatedData;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado',
        code: 'EMAIL_EXISTS'
      });
    }
    
    // Validate referral code
    let referrer = null;
    let specialCode = null;
    
    // First check if it's a special code
    specialCode = await SpecialCode.findOne({
      code: referralCode,
      isActive: true
    });
    
    if (specialCode) {
      // Check if special code is valid
      if (!specialCode.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Código especial inválido o expirado',
          code: 'INVALID_SPECIAL_CODE'
        });
      }
      
      logger.info('User registering with special code', {
        email,
        specialCode: referralCode,
        codeType: specialCode.type
      });
    } else {
      // Check if it's a regular user referral code
      referrer = await User.findOne({ referralCode });
      
      if (!referrer) {
        return res.status(400).json({
          success: false,
          message: 'Código de referido inválido',
          code: 'INVALID_REFERRAL_CODE'
        });
      }
      
      if (!referrer.isActive) {
        return res.status(400).json({
          success: false,
          message: 'El usuario referidor no está activo',
          code: 'REFERRER_INACTIVE'
        });
      }
    }
    
    // Create new user
    const newUser = new User({
      email: email.toLowerCase(),
      password, // Will be hashed by pre-save middleware
      firstName,
      lastName,
      phone,
      country,
      referredBy: referrer?._id,
      telegramUsername,
      registrationIP: req.ip,
      userAgent: req.get('User-Agent'),
      isActive: true,
      isVerified: process.env.REQUIRE_EMAIL_VERIFICATION !== 'true' // Auto-verify if not required
    });
    
    await newUser.save();
    
    // Update special code usage if applicable
    if (specialCode) {
      await SpecialCode.findByIdAndUpdate(specialCode._id, {
        $inc: { usageCount: 1 },
        $push: {
          usedBy: {
            user: newUser._id,
            usedAt: new Date()
          }
        }
      });
    }
    
    // Update referrer's referral count
    if (referrer) {
      await User.findByIdAndUpdate(referrer._id, {
        $inc: { 'referralStats.totalReferrals': 1 }
      });
    }
    
    // Generate JWT token
    const token = generateToken(newUser);
    
    logger.info('User registered successfully', {
      userId: newUser.userId,
      email: newUser.email,
      referredBy: referrer?.userId || 'special_code',
      ip: req.ip
    });
    
    // Return success response
    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      data: {
        user: {
          userId: newUser.userId,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          referralCode: newUser.referralCode,
          isVerified: newUser.isVerified,
          createdAt: newUser.createdAt
        },
        token
      }
    });
    
  } catch (error) {
    logger.error('Registration error:', {
      error: error.message,
      stack: error.stack,
      body: req.body,
      ip: req.ip
    });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Datos de registro inválidos',
        code: 'VALIDATION_ERROR',
        errors: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
    }
    
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} ya está en uso`,
        code: 'DUPLICATE_FIELD'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post('/login', authLimiter, async (req, res) => {
  try {
    // Validate request body
    const validatedData = loginSchema.parse(req.body);
    const { email, password } = validatedData;
    
    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Log failed login attempt
      logger.warn('Login attempt with non-existent email', {
        email,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // Check if account is active
    if (!user.isActive) {
      logger.warn('Login attempt on inactive account', {
        userId: user.userId,
        email: user.email,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        message: 'Cuenta desactivada',
        code: 'ACCOUNT_DISABLED'
      });
    }
    
    // Check if account is locked
    if (user.isAccountLocked) {
      logger.warn('Login attempt on locked account', {
        userId: user.userId,
        email: user.email,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        message: 'Cuenta bloqueada por múltiples intentos fallidos',
        code: 'ACCOUNT_LOCKED'
      });
    }
    
    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      // Record failed login attempt
      await user.recordFailedLogin(req.ip);
      
      logger.warn('Failed login attempt', {
        userId: user.userId,
        email: user.email,
        ip: req.ip,
        failedAttempts: user.security.failedLoginAttempts + 1
      });
      
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // Reset failed login attempts on successful login
    await user.resetFailedLogins();
    
    // Update last login
    user.lastLoginAt = new Date();
    user.lastLoginIP = req.ip;
    await user.save();
    
    // Generate JWT token
    const token = generateToken(user);
    
    logger.info('User logged in successfully', {
      userId: user.userId,
      email: user.email,
      ip: req.ip
    });
    
    // Return success response
    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      data: {
        user: {
          userId: user.userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          referralCode: user.referralCode,
          isVerified: user.isVerified,
          balances: user.balances,
          lastLoginAt: user.lastLoginAt
        },
        token
      }
    });
    
  } catch (error) {
    logger.error('Login error:', {
      error: error.message,
      stack: error.stack,
      body: { email: req.body.email }, // Don't log password
      ip: req.ip
    });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Datos de inicio de sesión inválidos',
        code: 'VALIDATION_ERROR',
        errors: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    // Get referrer information if exists
    let referrerInfo = null;
    if (user.referredBy) {
      const referrer = await User.findById(user.referredBy)
        .select('userId firstName lastName email');
      
      if (referrer) {
        referrerInfo = {
          userId: referrer.userId,
          firstName: referrer.firstName,
          lastName: referrer.lastName,
          email: referrer.email
        };
      }
    }
    
    res.json({
      success: true,
      data: {
        user: {
          userId: user.userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          country: user.country,
          role: user.role,
          referralCode: user.referralCode,
          isActive: user.isActive,
          isVerified: user.isVerified,
          balances: user.balances,
          referralStats: user.referralStats,
          telegramUsername: user.telegramUsername,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          referrer: referrerInfo
        }
      }
    });
    
  } catch (error) {
    logger.error('Get profile error:', {
      error: error.message,
      userId: req.user?.userId,
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (client-side token removal)
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    logger.info('User logged out', {
      userId: req.user.userId,
      email: req.user.email,
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: 'Sesión cerrada exitosamente'
    });
    
  } catch (error) {
    logger.error('Logout error:', {
      error: error.message,
      userId: req.user?.userId,
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;