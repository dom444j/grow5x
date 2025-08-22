/**
 * Authentication Routes
 * Handles user registration, login, and profile management
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { User, SpecialCode, PasswordReset } = require('../models');
const { authenticateToken, generateToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { cacheUserData } = require('../middleware/redisCache');
const { DecimalCalc } = require('../utils/decimal');
const logger = require('../config/logger');
const Telegram = require('../services/telegramNotify');
const telegramActivationService = require('../services/telegramActivationService');
const getUserSnapshot = require('../services/snapshots/getUserSnapshot');

const router = express.Router();



// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  firstName: z.string().min(1, 'Nombre es requerido').max(50, 'Nombre muy largo'),
  lastName: z.string().min(1, 'Apellido es requerido').max(50, 'Apellido muy largo'),
  phone: z.string().min(10, 'Teléfono inválido').max(20, 'Teléfono muy largo'),
  country: z.string().min(2, 'País es requerido').max(50, 'País muy largo'),
  referralCode: z.string().optional(), // Made optional to read from cookie if not provided
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
      telegramUsername
    } = validatedData;
    
    // Get referral code from body or cookie
    let referralCode = validatedData.referralCode || req.cookies?.g5x_ref;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado',
        code: 'EMAIL_EXISTS'
      });
    }
    
    // Validate referral code (required)
    if (!referralCode) {
      return res.status(400).json({
        success: false,
        message: 'Código de referido es requerido',
        code: 'REFERRAL_CODE_REQUIRED'
      });
    }
    
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
      isActive: false, // User needs to be activated via Telegram or manually by admin
      isVerified: process.env.REQUIRE_EMAIL_VERIFICATION !== 'true', // Auto-verify if not required
      telegramVerified: false
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
    
    // Send Telegram notifications and activation (non-blocking)
    setImmediate(async () => {
      try {
        // Send welcome notification
        Telegram.notifyWelcome(newUser);
        Telegram.notifyNewSignupAdmin(newUser);
        
        // Send activation message if Telegram username is provided
        if (telegramUsername) {
          try {
            // Note: In a real implementation, you would need to resolve telegramUsername to chatId
            // For now, we'll use the username as a placeholder
            await telegramActivationService.sendActivationMessage(
              newUser.userId,
              telegramUsername, // This should be resolved to actual chatId
              {
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                email: newUser.email,
                userId: newUser.userId
              }
            );
            
            logger.info('Activation message sent to new user', {
              userId: newUser.userId,
              telegramUsername
            });
          } catch (activationError) {
            logger.warn('Failed to send activation message', {
              userId: newUser.userId,
              telegramUsername,
              error: activationError.message
            });
          }
        }
      } catch (error) {
        logger.warn('Error in post-registration notifications', {
          userId: newUser.userId,
          error: error.message
        });
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
    if (user.isLocked) {
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
      await user.incLoginAttempts();
      
      logger.warn('Failed login attempt', {
        userId: user.userId,
        email: user.email,
        ip: req.ip,
        failedAttempts: user.loginAttempts + 1
      });
      
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // Reset failed login attempts on successful login
    await user.resetLoginAttempts();
    
    // Update last login
    user.lastLogin = new Date();
    user.lastIP = req.ip;
    await user.save();
    
    // Generate JWT token
    const token = generateToken(user);
    
    // Calculate token expiration time
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    const expirationTime = DecimalCalc.round(Date.now() / 1000) + DecimalCalc.multiply(7, DecimalCalc.multiply(24, DecimalCalc.multiply(60, 60))); // 7 days in seconds
    
    logger.info('User logged in successfully', {
      userId: user.userId,
      email: user.email,
      ip: req.ip
    });
    
    // Set httpOnly cookie for authentication
    res.cookie('access_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // dev mode (set to true in production with HTTPS)
      path: '/',
      maxAge: DecimalCalc.multiply(1000, DecimalCalc.multiply(60, DecimalCalc.multiply(60, 8))) // 8 hours
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
          lastLogin: user.lastLogin
        },
        token,
        exp: expirationTime
      }
    });
    
    // Send Telegram login notification (non-blocking)
    const ip = req.headers['x-real-ip'] || req.ip;
    const ua = req.headers['user-agent'];
    setImmediate(() => {
      try {
        Telegram.notifyLogin(user, ip, ua);
      } catch {}
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
router.get('/me', authenticateToken, cacheUserData(10), async (req, res, next) => {
  try {
    const user = await User.findOne({ userId: req.userId },
      { email:1, firstName:1, lastName:1, 'settings.defaultWithdrawalAddress':1 });
    const snap = await getUserSnapshot(req.userId);
    res.json({
      user: { email: user?.email, name: [user?.firstName, user?.lastName].filter(Boolean).join(' ') },
      balances: snap.balances,
      stats: snap.stats,
      settings: { defaultWithdrawalAddress: user?.settings?.defaultWithdrawalAddress || '' }
    });
  } catch (err) { next(err); }
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
    
    // Clear the access_token cookie
    res.clearCookie('access_token', {
      path: '/'
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

// Validation schemas for password reset
const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido')
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token es requerido'),
  code: z.string().length(6, 'Código debe tener 6 dígitos'),
  newPassword: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres')
});

/**
 * POST /api/auth/forgot-password
 * Request password reset via Telegram
 */
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    // Validate request body
    const validatedData = forgotPasswordSchema.parse(req.body);
    const { email } = validatedData;
    
    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({
        success: true,
        message: 'Si el email existe, recibirás un código de recuperación en Telegram'
      });
    }
    
    // Check if user has Telegram configured
    if (!user.telegramChatId) {
      return res.status(400).json({
        success: false,
        message: 'No tienes Telegram configurado. Contacta al soporte para recuperar tu contraseña.',
        code: 'NO_TELEGRAM'
      });
    }
    
    // Check if there's already a recent reset request
    const existingReset = await PasswordReset.findOne({
      email: email.toLowerCase(),
      used: false,
      expiresAt: { $gt: new Date() }
    });
    
    if (existingReset) {
      return res.status(429).json({
        success: false,
        message: 'Ya tienes una solicitud de recuperación activa. Revisa tu Telegram.',
        code: 'RESET_ALREADY_REQUESTED'
      });
    }
    
    // Generate token and code
    const { token, code } = PasswordReset.generateTokenAndCode();
    
    // Create password reset record
    const passwordReset = new PasswordReset({
      userId: user._id,
      email: email.toLowerCase(),
      token,
      code,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    await passwordReset.save();
    
    // Send Telegram message with reset code
    const resetMessage = 
      `🔐 <b>Recuperación de Contraseña</b>\n\n` +
      `Hola ${user.firstName},\n\n` +
      `Has solicitado recuperar tu contraseña de Grow5X.\n\n` +
      `🔢 <b>Tu código de recuperación es:</b>\n` +
      `<code>${code}</code>\n\n` +
      `⏰ Este código expira en 15 minutos.\n` +
      `🔒 Si no solicitaste esto, ignora este mensaje.\n\n` +
      `Para completar el proceso, ingresa este código en la página de recuperación.`;
    
    try {
      await Telegram.notifyUser(user, resetMessage);
      
      logger.info('Password reset requested', {
        userId: user.userId,
        email: user.email,
        ip: req.ip
      });
      
      res.json({
        success: true,
        message: 'Código de recuperación enviado a tu Telegram',
        data: {
          token // Frontend needs this to complete the reset
        }
      });
      
    } catch (telegramError) {
      // Delete the reset record if Telegram fails
      await PasswordReset.findByIdAndDelete(passwordReset._id);
      
      logger.error('Failed to send Telegram reset code', {
        userId: user.userId,
        email: user.email,
        error: telegramError.message,
        ip: req.ip
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al enviar el código por Telegram. Inténtalo más tarde.',
        code: 'TELEGRAM_ERROR'
      });
    }
    
  } catch (error) {
    logger.error('Forgot password error:', {
      error: error.message,
      stack: error.stack,
      body: { email: req.body.email },
      ip: req.ip
    });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Email inválido',
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
 * POST /api/auth/reset-password
 * Reset password using token and code from Telegram
 */
router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    // Validate request body
    const validatedData = resetPasswordSchema.parse(req.body);
    const { token, code, newPassword } = validatedData;
    
    // Find password reset record
    const passwordReset = await PasswordReset.findOne({
      token,
      used: false
    }).populate('userId');
    
    if (!passwordReset) {
      return res.status(400).json({
        success: false,
        message: 'Token de recuperación inválido o expirado',
        code: 'INVALID_TOKEN'
      });
    }
    
    // Check if expired
    if (passwordReset.isExpired()) {
      return res.status(400).json({
        success: false,
        message: 'El código de recuperación ha expirado',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    // Check if can attempt
    if (!passwordReset.canAttempt()) {
      return res.status(400).json({
        success: false,
        message: 'Demasiados intentos fallidos. Solicita un nuevo código.',
        code: 'TOO_MANY_ATTEMPTS'
      });
    }
    
    // Verify code
    if (passwordReset.code !== code) {
      await passwordReset.incrementAttempts();
      
      logger.warn('Invalid reset code attempt', {
        userId: passwordReset.userId.userId,
        email: passwordReset.email,
        attempts: passwordReset.attempts + 1,
        ip: req.ip
      });
      
      return res.status(400).json({
        success: false,
        message: 'Código de recuperación incorrecto',
        code: 'INVALID_CODE',
        attemptsLeft: 3 - (passwordReset.attempts + 1)
      });
    }
    
    // Get user
    const user = passwordReset.userId;
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Update user password
    user.password = newPassword; // Will be hashed by pre-save middleware
    await user.save();
    
    // Mark reset as used
    await passwordReset.markAsUsed();
    
    // Invalidate all user tokens for security
    await user.invalidateTokens();
    
    logger.info('Password reset completed', {
      userId: user.userId,
      email: user.email,
      ip: req.ip
    });
    
    // Send confirmation to Telegram
    const confirmationMessage = 
      `✅ <b>Contraseña Actualizada</b>\n\n` +
      `Tu contraseña de Grow5X ha sido cambiada exitosamente.\n\n` +
      `🕐 Fecha: ${new Date().toLocaleString('es-ES', { timeZone: 'America/Mexico_City' })}\n` +
      `🌐 IP: ${req.ip}\n\n` +
      `Si no fuiste tú, contacta inmediatamente al soporte.`;
    
    try {
      await Telegram.notifyUser(user, confirmationMessage);
    } catch (telegramError) {
      // Don't fail the reset if Telegram notification fails
      logger.warn('Failed to send password reset confirmation', {
        userId: user.userId,
        error: telegramError.message
      });
    }
    
    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });
    
  } catch (error) {
    logger.error('Reset password error:', {
      error: error.message,
      stack: error.stack,
      body: { token: req.body.token, code: req.body.code },
      ip: req.ip
    });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Datos de recuperación inválidos',
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

module.exports = router;