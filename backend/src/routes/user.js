/**
 * User Routes
 * Handles user profile, withdrawals, and account management
 */

const express = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const { User, Withdrawal, Transaction, Commission, Purchase, Package, Wallet, BenefitLedger, License } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { paymentLimiter } = require('../middleware/rateLimiter');
const { validatePurchase, validateWalletAddress, validateAmount } = require('../middleware/validation');
const { userDashboardCache } = require('../middleware/cache');
const { cacheUserData } = require('../middleware/redisCache');
const { validateWithdrawalRequest } = require('../middleware/usdtBep20Hardening');
const { validateWithdrawal } = require('../middleware/validation');
const otpService = require('../services/otpService');
const telegramService = require('../services/telegram');
const logger = require('../config/logger');
const ReferralController = require('../controllers/referralController');
const { toApiNumber, DecimalCalc } = require('../utils/decimal');
const transactionService = require('../services/transactionService');
const realtimeSyncService = require('../services/realtimeSyncService');
const CacheInvalidationService = require('../services/cacheInvalidationService');
const { middleware: responseStandardizer } = require('../middleware/responseStandardizer');
const { stateMapperMiddleware } = require('../utils/stateMapper');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/me
 * Root endpoint - redirects to overview
 */
router.get('/', (req, res) => {
  res.redirect(307, '/api/me/overview');
});

// Rate limiting for withdrawal requests (disabled for testing)
const withdrawalLimiter = (req, res, next) => next(); // Bypass rate limiting for testing
/*
const withdrawalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Max 3 withdrawal requests per 15 minutes
  message: {
    success: false,
    message: 'Demasiadas solicitudes de retiro. Intenta nuevamente en 15 minutos.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});
*/

// Validation schemas
const withdrawalRequestSchema = z.object({
  amountUSDT: z.number()
    .min(10, 'El monto mínimo de retiro es 10 USDT')
    .max(10000, 'El monto máximo de retiro es 10,000 USDT'),
  toAddress: z.string()
    .min(26, 'Dirección de destino inválida')
    .max(50, 'Dirección de destino inválida')
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Dirección BEP20 inválida'),
  pin: z.string()
    .length(6, 'PIN debe tener exactamente 6 dígitos')
    .regex(/^\d{6}$/, 'PIN debe contener solo números')
});

const requestOtpSchema = z.object({
  purpose: z.enum(['withdrawal'], 'Propósito no válido').default('withdrawal')
});

const updateProfileSchema = z.object({
  firstName: z.string().min(2, 'Nombre debe tener al menos 2 caracteres').optional(),
  lastName: z.string().min(2, 'Apellido debe tener al menos 2 caracteres').optional(),
  phone: z.string().min(10, 'Teléfono debe tener al menos 10 dígitos').optional(),
  country: z.string().min(2, 'País debe tener al menos 2 caracteres').optional(),
  telegramUsername: z.string().min(3, 'Usuario de Telegram inválido').optional()
});

const updateSettingsSchema = z.object({
  defaultWithdrawalAddress: z.string()
    .min(26, 'Dirección de retiro inválida')
    .max(50, 'Dirección de retiro inválida')
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Dirección BEP20 inválida')
    .optional(),
  network: z.enum(['BEP20'], {
    errorMap: () => ({ message: 'Solo se permite red BEP20' })
  }).optional()
});

// Purchase schemas
const createPurchaseSchema = z.object({
  packageId: z.string().min(1, 'Package ID es requerido'),
  amountUSDT: z.number().min(1, 'Monto debe ser mayor a 0')
});

const confirmTxSchema = z.object({
  txHash: z.string().min(1, 'Hash de transacción es requerido')
});

/**
 * GET /api/me/profile
 * Get current user profile with detailed information
 */
router.get('/profile', userDashboardCache(), responseStandardizer, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -security.resetPasswordToken -security.resetPasswordExpires')
      .populate('referredBy', 'userId email firstName lastName')
      .lean();
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Get additional statistics
    const [purchaseStats, commissionStats, withdrawalStats] = await Promise.all([
      // Purchase statistics
      Purchase.aggregate([
        { $match: { user: user._id } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' }
          }
        }
      ]),
      
      // Commission statistics
      Commission.aggregate([
        { $match: { earner: user._id } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$commissionAmount' }
          }
        }
      ]),
      
      // Withdrawal statistics
      Withdrawal.aggregate([
        { $match: { userId: user._id } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ])
    ]);
    
    // Transform statistics
    const stats = {
      purchases: {
        total: purchaseStats.reduce((sum, stat) => sum + stat.count, 0),
        totalInvested: toApiNumber(purchaseStats.reduce((sum, stat) => sum + (stat.totalAmount || 0), 0)),
        byStatus: purchaseStats.reduce((acc, stat) => {
          acc[stat._id] = { count: stat.count, amount: toApiNumber(stat.totalAmount || 0) };
          return acc;
        }, {})
      },
      commissions: {
        total: commissionStats.reduce((sum, stat) => sum + stat.count, 0),
        totalEarned: toApiNumber(commissionStats.reduce((sum, stat) => sum + (stat.totalAmount || 0), 0)),
        byStatus: commissionStats.reduce((acc, stat) => {
          acc[stat._id] = { count: stat.count, amount: toApiNumber(stat.totalAmount || 0) };
          return acc;
        }, {})
      },
      withdrawals: {
        total: withdrawalStats.reduce((sum, stat) => sum + stat.count, 0),
        totalWithdrawn: toApiNumber(withdrawalStats.reduce((sum, stat) => sum + (stat.totalAmount || 0), 0)),
        byStatus: withdrawalStats.reduce((acc, stat) => {
          acc[stat._id] = { count: stat.count, amount: toApiNumber(stat.totalAmount || 0) };
          return acc;
        }, {})
      }
    };
    
    res.success({
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
        balances: {
          availableBalance: toApiNumber(user.availableBalance || 0),
          totalInvested: toApiNumber(user.totalInvested || 0),
          totalEarnings: toApiNumber(user.totalEarnings || 0),
          totalWithdrawn: toApiNumber(user.totalWithdrawn || 0)
        },
        referralStats: user.referralStats,
        telegramUsername: user.telegramUsername,
        referredBy: user.referredBy ? {
          userId: user.referredBy.userId,
          email: user.referredBy.email,
          fullName: `${user.referredBy.firstName} ${user.referredBy.lastName}`
        } : null,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt
      },
      stats
    });
    
  } catch (error) {
    logger.error('Get user profile error:', {
      error: error.message,
      userId: req.user?.userId,
      ip: req.ip
    });
    
    res.error('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
});

/**
 * PUT /api/me/profile
 * Update user profile information
 */
// GET /api/me/settings - Get user settings
router.get('/settings', async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.user.userId })
      .select('defaultWithdrawalAddress network')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: {
        defaultWithdrawalAddress: user.defaultWithdrawalAddress || null,
        network: user.network || 'BEP20'
      }
    });

  } catch (error) {
    logger.error('Error getting user settings:', {
      userId: req.user.userId,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

// PUT /api/me/settings - Update user settings
router.put('/settings', async (req, res) => {
  try {
    const validation = updateSettingsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Datos de configuración inválidos',
        errors: validation.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        })),
        code: 'VALIDATION_ERROR'
      });
    }

    const { defaultWithdrawalAddress, network } = validation.data;
    const updateData = {};

    if (defaultWithdrawalAddress !== undefined) {
      updateData.defaultWithdrawalAddress = defaultWithdrawalAddress;
    }
    if (network !== undefined) {
      updateData.network = network;
    }

    const user = await User.findOneAndUpdate(
      { userId: req.user.userId },
      { $set: updateData },
      { new: true, select: 'defaultWithdrawalAddress network' }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    logger.info('User settings updated:', {
      userId: req.user.userId,
      updatedFields: Object.keys(updateData)
    });

    res.json({
      success: true,
      message: 'Configuración actualizada exitosamente',
      data: {
        defaultWithdrawalAddress: user.defaultWithdrawalAddress || null,
        network: user.network || 'BEP20'
      }
    });

  } catch (error) {
    logger.error('Error updating user settings:', {
      userId: req.user.userId,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

router.put('/profile', async (req, res) => {
  try {
    console.log('Profile update request body:', req.body);
    // Validate request body
    const validatedData = updateProfileSchema.parse(req.body);
    console.log('Validated profile data:', validatedData);
    
    // Update user profile
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        ...validatedData,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    ).select('-password -security.resetPasswordToken -security.resetPasswordExpires');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }
    
    logger.info('User profile updated', {
      userId: user.userId,
      updatedFields: Object.keys(validatedData),
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      data: {
        user: {
          userId: user.userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          country: user.country,
          telegramUsername: user.telegramUsername,
          updatedAt: user.updatedAt
        }
      }
    });
    
  } catch (error) {
    logger.error('Update user profile error:', {
      error: error.message,
      userId: req.user?.userId,
      body: req.body,
      ip: req.ip
    });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Datos de perfil inválidos',
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
 * GET /api/me/transactions
 * Get user transaction history
 */
router.get('/transactions', async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status } = req.query;
    
    // Build filter
    const filter = { userId: user.userId };
    
    if (type) {
      filter.type = type;
    }
    
    if (status) {
      filter.status = status;
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get transactions
    const transactions = await Transaction.find(filter)
      .populate('relatedPurchase', 'purchaseId package')
      .populate('relatedCommission', 'commissionId level')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count
    const totalCount = await Transaction.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        transactions: transactions.map(tx => ({
          transactionId: tx.transactionId,
          type: tx.type,
          amount: toApiNumber(tx.amount),
          currency: tx.currency,
          status: tx.status,
          description: tx.description,
          balanceAfter: toApiNumber(tx.balanceAfter),
          relatedPurchase: tx.relatedPurchase ? {
            purchaseId: tx.relatedPurchase.purchaseId,
            package: tx.relatedPurchase.package
          } : null,
          relatedCommission: tx.relatedCommission ? {
            commissionId: tx.relatedCommission.commissionId,
            level: tx.relatedCommission.level
          } : null,
          createdAt: tx.createdAt
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages: DecimalCalc.round(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + transactions.length < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    logger.error('Get user transactions error:', {
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
 * POST /api/me/otp/request
 * Request OTP PIN for withdrawal
 */
router.post('/otp/request', withdrawalLimiter, async (req, res) => {
  try {
    const validatedData = requestOtpSchema.parse(req.body);
    const { purpose } = validatedData;
    const userId = req.user._id;

    // Get user data
    const user = await User.findById(userId).select('telegramUsername isActive');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check if user account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Cuenta no activa. Contacte al soporte.',
        code: 'ACCOUNT_NOT_ACTIVE'
      });
    }

    // Check if user has Telegram configured
    if (!user.telegramUsername) {
      return res.status(400).json({
        success: false,
        message: 'Debe configurar su Telegram para recibir códigos OTP',
        code: 'TELEGRAM_NOT_CONFIGURED'
      });
    }

    // Check if there's already an active OTP
    const existingOtp = otpService.getOtpStatus(userId, purpose);
    if (existingOtp && !existingOtp.expired && !existingOtp.used) {
      return res.status(429).json({
        success: false,
        message: `Ya tiene un código OTP activo. Expira en ${DecimalCalc.round(existingOtp.timeRemaining / 60)} minutos.`,
        code: 'OTP_ALREADY_ACTIVE',
        data: {
          timeRemaining: existingOtp.timeRemaining,
          remainingAttempts: existingOtp.remainingAttempts
        }
      });
    }

    // Generate new OTP
    const otpData = otpService.createOtp(userId, purpose);
    
    // Send OTP via Telegram
    const telegramSent = await telegramService.sendOtpPin(
      user.telegramUsername,
      otpData.pin,
      purpose
    );

    if (!telegramSent) {
      // Remove the OTP if Telegram sending failed
      otpService.removeOtp(userId, purpose);
      
      return res.status(500).json({
        success: false,
        message: 'Error enviando código OTP. Intente nuevamente.',
        code: 'OTP_DELIVERY_FAILED'
      });
    }

    logger.info('OTP requested and sent', {
      userId: req.user.userId,
      purpose,
      otpId: otpData.otpId,
      expiresAt: otpData.expiresAt.toISOString()
    });

    res.json({
      success: true,
      message: 'Código OTP enviado a su Telegram',
      data: {
        otpId: otpData.otpId,
        expiresAt: otpData.expiresAt.toISOString(),
        purpose
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        code: 'VALIDATION_ERROR',
        errors: error.errors
      });
    }

    logger.error('Request OTP error:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.userId,
      body: req.body
    });

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/me/otp/status
 * Get OTP status for user
 */
router.get('/otp/status', async (req, res) => {
  try {
    const { purpose = 'withdrawal' } = req.query;
    const userId = req.user._id;

    const otpStatus = otpService.getOtpStatus(userId, purpose);

    if (!otpStatus) {
      return res.json({
        success: true,
        data: {
          hasActiveOtp: false,
          purpose
        }
      });
    }

    res.json({
      success: true,
      data: {
        hasActiveOtp: true,
        ...otpStatus,
        purpose
      }
    });

  } catch (error) {
    logger.error('Get OTP status error:', {
      error: error.message,
      userId: req.user?.userId,
      query: req.query
    });

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/me/withdrawals/otp
 * Request OTP specifically for withdrawals
 */
router.post('/withdrawals/otp', withdrawalLimiter, async (req, res) => {
  try {
    const userId = req.user._id;
    const purpose = 'withdrawal';

    // Get user data
    const user = await User.findById(userId).select('telegramUsername isActive');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check if user account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Cuenta no activa. Contacte al soporte.',
        code: 'ACCOUNT_NOT_ACTIVE'
      });
    }

    // Check if user has Telegram configured
    if (!user.telegramUsername) {
      return res.status(400).json({
        success: false,
        message: 'Debe configurar su Telegram para recibir códigos OTP',
        code: 'TELEGRAM_NOT_CONFIGURED'
      });
    }

    // Generate new OTP
    const pin = await otpService.generateOTP(userId, purpose, {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    // Send OTP via Telegram
    try {
      await otpService.sendOTPViaTelegram(userId, pin, purpose);
      
      logger.info('Withdrawal OTP requested and sent', {
        userId: req.user.userId,
        purpose,
        ip: req.ip
      });

      res.json({
        sent: true,
        message: 'Código OTP enviado a su Telegram',
        expiresIn: otpService.getExpirationTime(purpose) / 1000 // en segundos
      });
    } catch (telegramError) {
      logger.error('Error sending OTP via Telegram', {
        userId,
        error: telegramError.message
      });
      
      return res.status(500).json({
        sent: false,
        message: 'Error enviando código OTP. Verifique su configuración de Telegram.',
        code: 'OTP_DELIVERY_FAILED'
      });
    }

  } catch (error) {
    logger.error('Request withdrawal OTP error:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.userId,
      body: req.body
    });

    res.status(500).json({
      sent: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/me/withdrawals
 * Request a new withdrawal
 */
router.post('/withdrawals', withdrawalLimiter, validateWithdrawalRequest, validateWithdrawal, async (req, res) => {
  try {
    // Validate request body
    const validatedData = withdrawalRequestSchema.parse(req.body);
    const { amountUSDT, toAddress, pin } = validatedData;
    
    // Set fixed values for currency and network
    const amount = amountUSDT;
    const currency = 'USDT';
    const destinationAddress = toAddress;
    const network = 'BEP20';
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Check if user is active and verified
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Cuenta inactiva. Contacta al soporte.',
        code: 'ACCOUNT_INACTIVE'
      });
    }
    
    // Check if user has sufficient balance
    const availableBalance = parseFloat(user.availableBalance.toString()) || 0;
    if (availableBalance < amount) {
      return res.status(400).json({
        success: false,
        message: `Saldo insuficiente. Disponible: ${availableBalance} ${currency}`,
        code: 'INSUFFICIENT_BALANCE'
      });
    }
    
    // Check for pending withdrawals
    const pendingWithdrawal = await Withdrawal.findOne({
      userId: user._id,
      status: { $in: ['pending', 'approved', 'processing'] }
    });
    
    if (pendingWithdrawal) {
      return res.status(400).json({
        success: false,
        message: 'Ya tienes un retiro pendiente. Espera a que se complete.',
        code: 'PENDING_WITHDRAWAL_EXISTS'
      });
    }
    
    // Validate OTP PIN (with test bypass in development)
    let otpValidation;
    
    // Test bypass for development environment
    if (process.env.NODE_ENV === 'development' && pin === '123456') {
      logger.info('Using test OTP bypass for development', {
        userId: user._id,
        userEmail: user.email
      });
      otpValidation = { valid: true, message: 'Test OTP bypass' };
    } else {
      otpValidation = await otpService.verifyOTP(user._id, pin, 'withdrawal');
      
      if (!otpValidation.valid) {
        return res.status(400).json({
          success: false,
          message: otpValidation.reason,
          code: otpValidation.error,
          data: {
            remainingAttempts: otpValidation.remainingAttempts
          }
        });
      }
    }
    
    // Get current balance before withdrawal
    const currentBalance = user.availableBalance || 0;
    
    // Create withdrawal request with balance information
    const withdrawal = new Withdrawal({
      userId: user._id,
      amount,
      currency,
      destinationAddress,
      network,
      balanceBefore: currentBalance,
      status: 'pending',
      requestedAt: new Date(),
      networkFee: 1, // Default BEP20 fee
      processingFee: 0
    });
    
    await withdrawal.save();
    
    // Update user balance (reserve the amount)
    await user.updateBalance(currency, -amount, 'withdrawal_reserved');
    
    // Emit SSE event for withdrawal request
    try {
      const { emitToUser } = require('../utils/socketManager');
      await emitToUser(user._id.toString(), 'withdrawalRequested', {
        type: 'withdrawalRequested',
        data: {
          withdrawalId: withdrawal.withdrawalId,
          amount: withdrawal.amount,
          currency: withdrawal.currency,
          status: withdrawal.status,
          destinationAddress: withdrawal.destinationAddress,
          network: withdrawal.network,
          requestedAt: withdrawal.requestedAt
        },
        timestamp: new Date().toISOString()
      });
    } catch (sseError) {
      logger.warn('Failed to emit withdrawal request SSE event:', {
        userId: user._id,
        withdrawalId: withdrawal.withdrawalId,
        error: sseError.message
      });
    }
    
    logger.info('Withdrawal request created', {
      userId: user.userId,
      withdrawalId: withdrawal.withdrawalId,
      amount,
      currency,
      network,
      destinationAddress: destinationAddress.substring(0, 6) + '...' + destinationAddress.substring(-4),
      ip: req.ip
    });
    
    res.json({
      success: true,
      data: {
        withdrawalId: withdrawal.withdrawalId,
        amount: withdrawal.amount,
        currency: withdrawal.currency,
        status: withdrawal.status,
        walletAddress: withdrawal.destinationAddress,
        network: withdrawal.network,
        requestedAt: withdrawal.requestedAt
      }
    });
    
  } catch (error) {
    logger.error('Create withdrawal error:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.userId,
      body: req.body,
      ip: req.ip
    });
    
    console.error('WITHDRAWAL ERROR DETAILS:');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Request body:', req.body);
    console.error('User ID:', req.user?.userId);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Datos de retiro inválidos',
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
 * GET /api/me/withdrawals
 * Get user withdrawal history with summary
 */
router.get('/withdrawals', cacheUserData(10), stateMapperMiddleware('withdrawal'), async (req, res) => {
  try {
    // Validate user exists
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }
    
    const { page = 1, limit = 20, status } = req.query;
    const getUserSnapshot = require('../services/snapshots/getUserSnapshot');
    
    // Validate and sanitize pagination parameters
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Build filter
    const filter = { userId: req.user._id };
    
    if (status && typeof status === 'string') {
      filter.status = status;
    }
    
    // Calculate pagination
    const skip = (pageNum - 1) * limitNum;
    
    // Use Promise.all for parallel queries to improve performance
    const [withdrawals, totalCount, snapshot] = await Promise.all([
      Withdrawal.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(), // Use lean() for better performance
      Withdrawal.countDocuments(filter),
      getUserSnapshot(req.user._id)
    ]);
    
    const minWithdrawalUSDT = 10;
    const sla = '24–48h manual';
    
    res.json({
      summary: {
        availableUSDT: snapshot.balances.availableBalance,
        pendingUSDT: snapshot.balances.pendingBalance,
        minWithdrawalUSDT,
        sla
      },
      items: (withdrawals || []).map(withdrawal => ({
        id: withdrawal?.withdrawalId || withdrawal?._id?.toString() || '',
        amountUSDT: toApiNumber(parseFloat(withdrawal?.amount) || 0),
        toAddress: withdrawal?.destinationAddress || '',
        status: withdrawal?.status?.toUpperCase() || 'REQUESTED',
        createdAt: withdrawal?.createdAt || null
      })),
      total: totalCount || 0
    });
    
  } catch (error) {
    logger.error('Get user withdrawals error:', {
      error: error.message,
      stack: error.stack,
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
 * GET /api/me/withdrawals/stats
 * Get user withdrawal statistics and summary
 */
router.get('/withdrawals/stats', async (req, res) => {
  try {
    const { Ledger } = require('../models');
    
    const user = await User.findById(req.user._id).select('balances');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    // Calculate availableUSDT from BenefitLedger and Ledger
    // Get daily benefits from BenefitLedger
    const benefitAggregation = await BenefitLedger.aggregate([
      {
        $match: {
          userId: req.user._id,
          type: 'DAILY_BENEFIT',
          status: 'paid'
        }
      },
      {
        $group: {
          _id: null,
          dailyBenefits: { $sum: '$amount' }
        }
      }
    ]);
    
    // Get other credits and withdrawals from Ledger
    const ledgerAggregation = await Ledger.aggregate([
      {
        $match: {
          userId: req.user._id,
          currency: 'USDT',
          status: 'confirmed'
        }
      },
      {
        $group: {
          _id: null,
          credits: {
            $sum: {
              $cond: [
                { $in: ['$type', ['REFERRAL_DIRECT', 'REFERRAL_INDIRECT', 'BONUS', 'ADJUSTMENT']] },
                '$amount',
                0
              ]
            }
          },
          withdrawals: {
            $sum: {
              $cond: [
                { $eq: ['$type', 'WITHDRAWAL'] },
                '$amount',
                0
              ]
            }
          }
        }
      }
    ]);
    
    const benefitSummary = benefitAggregation[0] || { dailyBenefits: 0 };
    const ledgerSummary = ledgerAggregation[0] || { credits: 0, withdrawals: 0 };
    const totalCredits = DecimalCalc.add(benefitSummary.dailyBenefits, ledgerSummary.credits);
    const availableUSDT = DecimalCalc.max(0, DecimalCalc.add(totalCredits, ledgerSummary.withdrawals)); // withdrawals are negative
    
    // Get pending withdrawals amount
    const pendingWithdrawals = await Withdrawal.aggregate([
      {
        $match: {
          userId: req.user._id,
          status: { $in: ['pending', 'approved', 'processing'] }
        }
      },
      {
        $group: {
          _id: null,
          totalPending: { $sum: '$amount' }
        }
      }
    ]);
    
    const pendingUSDT = pendingWithdrawals[0]?.totalPending || 0;
    
    // Minimum withdrawal amount (from validation schema)
    const minWithdrawalUSDT = 10;
    
    // SLA in hours (typical processing time)
    const sla = '24–48h manual';
    
    // Get withdrawal history for additional stats
    const withdrawalStats = await Withdrawal.aggregate([
      {
        $match: {
          userId: req.user._id
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);
    
    const items = await Withdrawal.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('withdrawalId amount currency destinationAddress network status createdAt approvedAt completedAt txHash');
    
    res.json({
      success: true,
      data: {
        items: items.map(withdrawal => ({
          withdrawalId: withdrawal.withdrawalId,
          amount: withdrawal.amount,
          currency: withdrawal.currency,
          destinationAddress: withdrawal.destinationAddress,
          network: withdrawal.network,
          status: withdrawal.status,
          createdAt: withdrawal.createdAt,
          approvedAt: withdrawal.approvedAt,
          completedAt: withdrawal.completedAt,
          txHash: withdrawal.txHash
        })),
        summary: {
          availableUSDT: toApiNumber(availableUSDT),
          pendingUSDT: toApiNumber(pendingUSDT),
          minWithdrawalUSDT,
          sla
        }
      }
    });
    
  } catch (error) {
    logger.error('Get withdrawal stats error:', {
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
 * GET /api/me/commissions
 * Get user commission history
 */
router.get('/commissions', stateMapperMiddleware('commission'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status, level } = req.query;
    
    // Build filter
    const filter = { earner: req.user._id };
    
    if (status) {
      filter.status = status;
    }
    
    if (level) {
      filter.level = parseInt(level);
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get commissions
    const commissions = await Commission.find(filter)
      .populate('referredUser', 'userId email firstName lastName')
      .populate('relatedPurchase', 'purchaseId totalAmount')
      .populate('relatedPackage', 'packageId name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count
    const totalCount = await Commission.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        commissions: commissions.map(commission => ({
          commissionId: commission.commissionId,
          level: commission.level,
          commissionRate: commission.commissionRate,
          commissionAmount: toApiNumber(commission.commissionAmount),
          currency: commission.currency,
          status: commission.status,
          referredUser: {
            userId: commission.referredUser.userId,
            email: commission.referredUser.email,
            fullName: `${commission.referredUser.firstName} ${commission.referredUser.lastName}`
          },
          relatedPurchase: {
            purchaseId: commission.relatedPurchase.purchaseId,
            amount: toApiNumber(commission.relatedPurchase.totalAmount)
          },
          relatedPackage: {
            packageId: commission.relatedPackage.packageId,
            name: commission.relatedPackage.name
          },
          unlockDate: commission.unlockDate,
          createdAt: commission.createdAt,
          unlockedAt: commission.unlockedAt
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages: DecimalCalc.round(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + commissions.length < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    logger.error('Get user commissions error:', {
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
 * GET /api/me/referrals/tree
 * Get user referral tree structure
 */
router.get('/referrals/tree', async (req, res) => {
  try {
    const { depth = 3, includeStats = true } = req.query;
    const userId = req.user._id;
    
    const ReferralTreeService = require('../services/ReferralTreeService');
    const treeData = await ReferralTreeService.getReferralTree(
      userId, 
      parseInt(depth), 
      includeStats === 'true'
    );
    
    res.json({
      success: true,
      data: treeData
    });
    
  } catch (error) {
    logger.error('Get referral tree error:', {
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
 * GET /api/me/referrals/summary
 * Get user referral tree summary
 */
router.get('/referrals/summary', async (req, res) => {
  try {
    const userId = req.user._id;
    
    const ReferralTreeService = require('../services/ReferralTreeService');
    const summary = await ReferralTreeService.getTreeSummary(userId);
    
    res.json({
      success: true,
      data: summary
    });
    
  } catch (error) {
    logger.error('Get referral summary error:', {
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
 * GET /api/me/commissions/locked
 * Get user locked commissions amount
 */
router.get('/commissions/locked', async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get locked commissions
    const lockedCommissions = await Commission.aggregate([
      {
        $match: {
          earner: userId,
          status: 'locked'
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$commissionAmount' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    const result = lockedCommissions[0] || { totalAmount: 0, count: 0 };
    
    res.json({
      success: true,
      data: {
        lockedCommissions: toApiNumber(result.totalAmount),
        count: result.count
      }
    });
    
  } catch (error) {
    logger.error('Get locked commissions error:', {
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
 * GET /api/me/benefits
 * Get user benefit schedules and history
 */
router.get('/benefits', async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const { BenefitSchedule, Ledger } = require('../models');
    
    // Build filter for benefit schedules
    const filter = { userId: req.user._id };
    
    if (status) {
      filter.scheduleStatus = status;
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get benefit schedules
    let benefitSchedules;
    try {
      benefitSchedules = await BenefitSchedule.find(filter)
        .populate({
          path: 'purchaseId',
          select: 'purchaseId totalAmount packageId confirmedAt',
          populate: {
            path: 'packageId',
            select: 'packageId name'
          }
        })
        .sort({ startAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
    } catch (populateError) {
      logger.error('Error in populate query:', {
        error: populateError.message,
        stack: populateError.stack
      });
      throw populateError;
    }
    
    // Get total count
    const totalCount = await BenefitSchedule.countDocuments(filter);
    
    // Get benefit ledger entries for this user
    const benefitLedgerEntries = await BenefitLedger.find({
      userId: req.user._id,
      type: 'DAILY_BENEFIT',
      status: 'paid'
    }).sort({ createdAt: -1 });
    
    // Get commission ledger entries for this user
    const commissionLedgerEntries = await Ledger.find({
      userId: req.user._id,
      type: 'REFERRAL_DIRECT',
      status: 'confirmed'
    }).sort({ createdAt: -1 });
    
    // Calculate summary statistics
    const summary = {
      totalBenefits: toApiNumber(benefitLedgerEntries.reduce((sum, entry) => sum + entry.amount, 0)),
      totalCommissions: toApiNumber(commissionLedgerEntries.reduce((sum, entry) => sum + entry.amount, 0)),
      activeBenefitSchedules: benefitSchedules.filter(schedule => schedule.scheduleStatus === 'active').length,
      completedBenefitSchedules: benefitSchedules.filter(schedule => schedule.scheduleStatus === 'completed').length
    };
    
    // Filter out schedules without purchaseId or packageId
    const validSchedules = benefitSchedules.filter(schedule => 
      schedule.purchaseId && schedule.purchaseId.packageId
    );
    
    // Transform benefit schedules for response
    const transformedSchedules = validSchedules
      .map(schedule => {
        const dailyBenefits = [];
        
        // Create daily benefit entries
        for (let day = 0; day < schedule.days; day++) {
          const dayData = schedule.statusByDay.get(day.toString());
          const dayStatus = dayData ? dayData.status : 'pending';
          const releaseDate = new Date(schedule.startAt);
          releaseDate.setDate(releaseDate.getDate() + day);
          
          dailyBenefits.push({
            day: day + 1,
            amount: toApiNumber(schedule.dailyBenefitAmount),
            releaseDate: releaseDate,
            status: dayStatus,
            releasedAt: dayData ? dayData.releasedAt : null
          });
        }
        
        // Calculate progress and remaining information
        const remainingDays = Math.max(0, schedule.days - schedule.daysReleased);
        const progressPercent = schedule.days > 0 ? (schedule.daysReleased / schedule.days) * 100 : 0;
        const remainingAmount = schedule.purchaseAmount - schedule.totalReleased;
        const capPercentMax = 100; // Default cap percentage, could be configurable
        const capReached = progressPercent >= capPercentMax;
        
        return {
          scheduleId: schedule._id,
          purchase: {
            purchaseId: schedule.purchaseId.purchaseId,
            totalAmount: toApiNumber(schedule.purchaseId.totalAmount),
            package: {
              packageId: schedule.purchaseId.packageId.packageId,
              name: schedule.purchaseId.packageId.name
            },
            confirmedAt: schedule.purchaseId.confirmedAt,
            paymentHash: schedule.purchaseId.paymentHash,
            walletAddress: schedule.purchaseId.assignedWallet?.address
          },
          startAt: schedule.startAt,
          days: schedule.days,
          dailyRate: schedule.dailyRate,
          dailyBenefitAmount: toApiNumber(schedule.dailyBenefitAmount),
          scheduleStatus: schedule.scheduleStatus,
          totalReleased: toApiNumber(schedule.totalReleased),
          daysReleased: schedule.daysReleased,
          remainingDays,
          remainingAmount: toApiNumber(remainingAmount),
          progressPercent: Math.round(progressPercent * 100) / 100,
          capPercentMax,
          capReached,
          isPaused: schedule.scheduleStatus === 'paused',
          pauseReason: schedule.metadata?.pauseReason || null,
          dailyBenefits: dailyBenefits,
          createdAt: schedule.createdAt
        };
      });
    
    res.json({
      success: true,
      data: {
        summary,
        benefitSchedules: transformedSchedules,
        benefitHistory: benefitLedgerEntries.map(entry => ({
          id: entry._id,
          amount: toApiNumber(entry.amount),
          currency: entry.currency,
          description: entry.description,
          purchaseId: entry.purchaseReference,
          dayIndex: entry.metadata?.dayIndex,
          createdAt: entry.createdAt
        })),
        commissionHistory: commissionLedgerEntries.map(entry => ({
          id: entry._id,
          amount: toApiNumber(entry.amount),
          currency: entry.currency,
          description: entry.description,
          purchaseId: entry.purchaseReference,
          referredUserId: entry.userReference,
          createdAt: entry.createdAt
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages: DecimalCalc.round(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + benefitSchedules.length < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    logger.error('Get user benefits error:', {
      error: error.message,
      stack: error.stack,
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
 * POST /api/me/purchases
 * Create a new purchase
 */
router.post('/purchases', paymentLimiter, validateAmount(0.01, 1000000), async (req, res) => {
  try {
    const validatedData = createPurchaseSchema.parse(req.body);
    const { packageId, amountUSDT } = validatedData;
    const user = req.user;
    
    // Get the full user document to access the ObjectId
    const userDoc = await User.findOne({ userId: user.userId });
    if (!userDoc) {
      return res.status(404).json({ 
        success: false,
        error: 'Usuario no encontrado' 
      });
    }

    // Find the package
    const package = await Package.findOne({ packageId, isActive: true });
    if (!package) {
      return res.status(404).json({ 
        success: false,
        error: 'Paquete no encontrado o no disponible' 
      });
    }

    // Get available wallet from pool (Pool V2 - LRS)
    const wallet = await Wallet.findOne({ 
      isActive: true, 
      status: 'AVAILABLE' 
    }).sort({ lastShownAt: 1 });
    
    if (!wallet) {
      return res.status(503).json({ 
        success: false,
        error: 'No hay wallets disponibles en este momento' 
      });
    }

    // Debug logging
    console.log('Creating purchase with data:', {
      userId: userDoc._id,
      userIdType: typeof userDoc._id,
      packageId,
      packageIdType: typeof packageId,
      walletId: wallet._id,
      walletIdType: typeof wallet._id,
      packageData: {
        dailyBenefitRate: package.dailyBenefitRate,
        benefitDays: package.benefitDays,
        totalCycles: package.totalCycles
      }
    });

    // Create purchase
    const purchase = await Purchase.create({
      userId: userDoc._id,
      packageId,
      quantity: 1,
      unitPrice: package.price,
      totalAmount: package.price,
      currency: 'USDT',
      assignedWallet: wallet._id,
      payTo: wallet.address,
      network: 'BEP20',
      status: 'PENDING_PAYMENT',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      benefitPlan: {
        dailyRate: package.dailyBenefitRate,
        daysPerCycle: package.benefitDays,
        totalCycles: package.totalCycles,
        totalBenefitAmount: package.price * package.dailyBenefitRate * package.benefitDays * package.totalCycles
      }
    });

    // Update wallet Pool V2 LRS tracking
    wallet.lastShownAt = new Date();
    wallet.shownCount += 1;
    await wallet.save();

    // Invalidate user cache after purchase creation
    CacheInvalidationService.invalidatePurchaseCache(userDoc._id.toString());

    res.status(201).json({
      success: true,
      message: 'Compra creada exitosamente',
      data: {
        purchase: {
          purchaseId: purchase.purchaseId,
          totalAmount: purchase.totalAmount,
          expiresAt: purchase.expiresAt
        },
        payment: {
          walletAddress: purchase.payTo,
          networkName: purchase.network
        }
      }
    });

  } catch (error) {
    logger.error('Create purchase error:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.userId,
      body: req.body,
      ip: req.ip
    });
    console.error('Full error details:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/me/purchases/:id/confirm
 * Confirm transaction hash for a purchase
 */
router.post('/purchases/:id/confirm', async (req, res) => {
  try {
    const validatedData = confirmTxSchema.parse(req.body);
    const { txHash } = validatedData;
    const purchaseId = req.params.id;
    const user = req.user;

    // Find purchase
    const purchase = await Purchase.findOne({ 
      purchaseId, 
      userId: user._id 
    });
    
    if (!purchase) {
      return res.status(404).json({ 
        success: false,
        error: 'Compra no encontrada' 
      });
    }

    if (purchase.status !== 'PENDING_PAYMENT') {
      return res.status(400).json({ 
        success: false,
        error: `La compra está en estado ${purchase.status}, no se puede confirmar` 
      });
    }

    // Check if txHash already exists
    const existingPurchase = await Purchase.findOne({
      txHash,
      _id: { $ne: purchase._id }
    });

    if (existingPurchase) {
      return res.status(400).json({
        success: false,
        error: 'Este hash de transacción ya está siendo usado en otra compra',
        code: 'TX_HASH_ALREADY_EXISTS'
      });
    }

    // Update purchase with transaction hash
    purchase.txHash = txHash;
    purchase.status = 'CONFIRMING';
    purchase.hashSubmittedAt = new Date();
    await purchase.save();

    res.json({ 
      success: true,
      message: 'Hash de transacción confirmado exitosamente' 
    });

  } catch (error) {
    logger.error('Confirm transaction error:', {
      error: error.message,
      stack: error.stack,
      purchaseId: req.params.id,
      userId: req.user?.userId,
      body: req.body,
      ip: req.ip
    });
    
    console.error('Full confirm transaction error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      purchaseId: req.params.id,
      userId: req.user?.userId
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * GET /api/me/purchases
 * Get user's purchase history (alias for /api/payments/my-purchases)
 */
router.get('/purchases', stateMapperMiddleware('purchase'), async (req, res) => {
  try {
    const user = req.user;
    
    // Validate user exists
    if (!user || !user._id) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }
    
    const { status, page = 1, limit = 10 } = req.query;
    
    // Validate and sanitize pagination parameters
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
    
    // Build filter
    const filter = { userId: user._id };
    if (status && typeof status === 'string') {
      filter.status = status;
    }
    
    // Calculate pagination
    const skip = (pageNum - 1) * limitNum;
    
    // Use Promise.all for parallel queries to improve performance
    const [purchases, totalCount] = await Promise.all([
      Purchase.find(filter)
        .populate('packageId', 'name price dailyRate')
        .populate('userId', 'email firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Purchase.countDocuments(filter)
    ]);
    
    // Import PurchaseDTO for standardized responses
    const PurchaseDTO = require('../dto/PurchaseDTO');
    const LicenseDataMapper = require('../services/LicenseDataMapper');
    
    // Transform purchases using PurchaseDTO
    const transformedPurchases = await Promise.all((purchases || []).map(async (purchase) => {
      // Calculate license stats for additional context
      const licenseStats = await LicenseDataMapper.calculateLicenseStats(purchase);
      
      // Use PurchaseDTO for standardized response
      return PurchaseDTO.forUser(purchase, { licenseStats });
    }));
    
    res.json({
      success: true,
      data: {
        purchases: transformedPurchases,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil((totalCount || 0) / limitNum),
          totalCount: totalCount || 0,
          hasNext: skip + (purchases?.length || 0) < (totalCount || 0),
          hasPrev: pageNum > 1
        }
      }
    });
    
  } catch (error) {
    logger.error('Get user purchases error:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.userId,
      ip: req.ip
    });
    
    console.error('Full error details:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/user/overview
 * Get user dashboard overview with consolidated KPIs
 */
router.get('/overview', responseStandardizer, async (req, res) => {
  try {
    logger.info('=== OVERVIEW ENDPOINT STARTED ===', {
      userId: req.user?._id,
      userIdString: req.user?.userId,
      ip: req.ip
    });
    
    const userId = req.user._id; // MongoDB ObjectId
    const userIdString = req.user.userId; // Custom userId field from user object
    
    // Use optimized DashboardService
    const DashboardService = require('../services/DashboardService');
    const OverviewDTO = require('../dto/OverviewDTO');
    logger.info('About to call DashboardService.getUserDashboard', { userId, userIdString });
    
    let overview;
    try {
      overview = await DashboardService.getUserDashboard(userId, userIdString);
      logger.info('DashboardService.getUserDashboard completed successfully');
    } catch (dashboardError) {
      logger.error('Error in DashboardService.getUserDashboard:', {
        error: dashboardError.message,
        stack: dashboardError.stack,
        userId,
        userIdString
      });
      throw dashboardError;
    }
    
    // Build referral link with public domain
    const baseUrl = process.env.APP_PUBLIC_BASE_URL || 'https://app.grow5x.app';
    const referralLink = `${baseUrl}/r/${overview.referral.code}`;
    
    // Add referral link to response
    overview.referral.link = referralLink;
    
    // Use OverviewDTO for standardized response
    const standardizedOverview = OverviewDTO.forUser(overview, { referralLink });
    
    res.success(standardizedOverview);
    
  } catch (error) {
    logger.error('Get user overview error:', {
      error: error.message,
      stack: error.stack,
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
 * GET /api/me/referrals
 * Get user's referral data and referred users
 */
router.get('/referrals', ReferralController.getUserReferrals);

/**
 * GET /api/me/referrals/stats
 * Get user's referral statistics
 */
router.get('/referrals/stats', ReferralController.getUserReferralStats);

/**
 * GET /api/user/licenses
 * Get user's licenses with cycle progress and schedule
 */
router.get('/licenses', cacheUserData(10), responseStandardizer, async (req, res) => {
  try {
    const { status = 'ALL' } = req.query;
    const userId = req.user._id;

    // Use same logic as admin but filtered by userId
    const licenses = await License.find({
      userId: userId,
      status: { $in: ['ACTIVE', 'PAUSED', 'COMPLETED'] }
    })
      .populate('packageId', 'name slug dailyRate')
      .populate('purchaseId', 'totalAmount createdAt')
      .sort({ createdAt: -1 })
      .lean();

    // Enrich with benefit data using same logic as admin
    const enrichedLicenses = await Promise.all(
      licenses.map(async (license) => {
        // Get total accrued benefits
        const benefitStats = await BenefitLedger.aggregate([
          {
            $match: {
              licenseId: license._id,
              type: 'DAILY_BENEFIT'
            }
          },
          {
            $group: {
              _id: null,
              totalAccrued: { $sum: '$amount' },
              daysGenerated: { $sum: 1 }
            }
          }
        ]);

        const stats = benefitStats[0] || { totalAccrued: 0, daysGenerated: 0 };
        const principalUSDT = license.principalAmount || license.purchaseId?.totalAmount || 0;
        const accruedUSDT = stats.totalAccrued;
        const earnedPct = principalUSDT > 0 ? (accruedUSDT / principalUSDT * 100) : 0;
        const capPct = license.capPercentMax || 100;
        const remainingUSDT = Math.max(0, (principalUSDT * capPct / 100) - accruedUSDT);
        
        // Calculate cycle and day information
        const daysGenerated = stats.daysGenerated;
        const cycleIndex = Math.floor(daysGenerated / 8);
        const daysPaidInCycle = daysGenerated % 8;
        const dayInCycle = daysPaidInCycle + 1;
        
        // Map status to user format
        let userStatus = 'pending';
        if (license.status === 'ACTIVE') userStatus = 'active';
        else if (license.status === 'COMPLETED') userStatus = 'completed';
        else if (license.status === 'PAUSED') userStatus = 'paused';
        
        // Generate schedule for current cycle
        const schedule = [];
        for (let day = 1; day <= 8; day++) {
          const dailyAmount = principalUSDT * (license.packageId?.dailyRate || 0) / 100;
          let dayStatus = 'pending';
          
          if (day <= daysPaidInCycle) {
            dayStatus = 'paid';
          } else if (day === dayInCycle && license.status === 'ACTIVE') {
            dayStatus = 'today';
          }
          
          const dayDate = new Date(license.activatedAt || license.createdAt);
          dayDate.setDate(dayDate.getDate() + (cycleIndex * 9) + (day - 1));
          
          schedule.push({
            day,
            amount: dailyAmount,
            status: dayStatus,
            date: dayDate
          });
        }

        return {
          _id: license._id,
          principalUSDT: Math.round(principalUSDT * 100) / 100,
          accruedUSDT: Math.round(accruedUSDT * 100) / 100,
          earnedPct: Math.round(earnedPct * 100) / 100,
          capPct,
          remainingUSDT: Math.round(remainingUSDT * 100) / 100,
          status: userStatus,
          daysGenerated,
          startedAt: license.activatedAt || license.createdAt,
          progress: {
            earnedPct: Math.round(earnedPct * 100) / 100,
            capPct,
            remainingPct: Math.round((capPct - earnedPct) * 100) / 100
          },
          plan: {
            dailyRate: license.packageId?.dailyRate || 0,
            benefitDays: 8,
            totalCycles: 5,
            capPercentMax: capPct
          },
          cycle: {
            current: cycleIndex + 1,
            total: 5,
            dayInCycle,
            isPauseToday: license.status === 'PAUSED'
          },
          schedule,
          package: {
            _id: license.packageId?._id,
            name: license.packageId?.name,
            slug: license.packageId?.slug
          }
        };
      })
    );
    
    // Filter by status if specified
    const filteredLicenses = status === 'ALL' ? enrichedLicenses : enrichedLicenses.filter(l => l.status === status);
    
    res.json({
      success: true,
      data: {
        items: filteredLicenses,
        total: filteredLicenses.length
      }
    });
    
  } catch (error) {
    logger.error('Get user licenses error:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?._id,
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
 * PATCH /api/user/wallet
 * Update user's default withdrawal address
 */
router.patch('/wallet', async (req, res) => {
  try {
    const { defaultWithdrawalAddress } = req.body;
    
    // Validate address format if provided
    if (defaultWithdrawalAddress && !/^0x[a-fA-F0-9]{40}$/.test(defaultWithdrawalAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de dirección BEP20 inválido',
        code: 'INVALID_ADDRESS_FORMAT'
      });
    }
    
    // Update user's default withdrawal address
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { defaultWithdrawalAddress },
      { new: true, runValidators: true }
    ).select('defaultWithdrawalAddress');
    
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Emit SSE event for wallet update
    try {
      const { emitToUser } = require('../utils/socketManager');
      await emitToUser(req.user._id.toString(), 'walletUpdated', {
        type: 'walletUpdated',
        data: {
          defaultWithdrawalAddress: updatedUser.defaultWithdrawalAddress
        },
        timestamp: new Date().toISOString()
      });
    } catch (sseError) {
      logger.warn('Failed to emit wallet update SSE event:', {
        userId: req.user._id,
        error: sseError.message
      });
    }
    
    res.json({
      success: true,
      message: 'Dirección de retiro actualizada exitosamente',
      data: {
        defaultWithdrawalAddress: updatedUser.defaultWithdrawalAddress
      }
    });
    
  } catch (error) {
    logger.error('Update wallet error:', {
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