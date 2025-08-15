/**
 * User Routes
 * Handles user profile, withdrawals, and account management
 */

const express = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const { User, Withdrawal, Transaction, Commission, Purchase } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const otpService = require('../services/otp');
const telegramService = require('../services/telegram');
const logger = require('../config/logger');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Rate limiting for withdrawal requests
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

// Validation schemas
const withdrawalRequestSchema = z.object({
  amount: z.number()
    .min(50, 'El monto mínimo de retiro es 50 USDT')
    .max(10000, 'El monto máximo de retiro es 10,000 USDT'),
  currency: z.enum(['USDT'], {
    errorMap: () => ({ message: 'Solo se permite USDT' })
  }),
  destinationAddress: z.string()
    .min(26, 'Dirección de destino inválida')
    .max(50, 'Dirección de destino inválida')
    .regex(/^[a-zA-Z0-9]+$/, 'Dirección de destino contiene caracteres inválidos'),
  network: z.enum(['BEP20', 'TRC20'], {
    errorMap: () => ({ message: 'Red debe ser BEP20 o TRC20' })
  }),
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

/**
 * GET /api/me/profile
 * Get current user profile with detailed information
 */
router.get('/profile', async (req, res) => {
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
        { $match: { user: user._id } },
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
        totalInvested: purchaseStats.reduce((sum, stat) => sum + (stat.totalAmount || 0), 0),
        byStatus: purchaseStats.reduce((acc, stat) => {
          acc[stat._id] = { count: stat.count, amount: stat.totalAmount || 0 };
          return acc;
        }, {})
      },
      commissions: {
        total: commissionStats.reduce((sum, stat) => sum + stat.count, 0),
        totalEarned: commissionStats.reduce((sum, stat) => sum + (stat.totalAmount || 0), 0),
        byStatus: commissionStats.reduce((acc, stat) => {
          acc[stat._id] = { count: stat.count, amount: stat.totalAmount || 0 };
          return acc;
        }, {})
      },
      withdrawals: {
        total: withdrawalStats.reduce((sum, stat) => sum + stat.count, 0),
        totalWithdrawn: withdrawalStats.reduce((sum, stat) => sum + (stat.totalAmount || 0), 0),
        byStatus: withdrawalStats.reduce((acc, stat) => {
          acc[stat._id] = { count: stat.count, amount: stat.totalAmount || 0 };
          return acc;
        }, {})
      }
    };
    
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
          referredBy: user.referredBy ? {
            userId: user.referredBy.userId,
            email: user.referredBy.email,
            fullName: `${user.referredBy.firstName} ${user.referredBy.lastName}`
          } : null,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt
        },
        stats
      }
    });
    
  } catch (error) {
    logger.error('Get user profile error:', {
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
 * PUT /api/me/profile
 * Update user profile information
 */
router.put('/profile', async (req, res) => {
  try {
    // Validate request body
    const validatedData = updateProfileSchema.parse(req.body);
    
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
    const filter = { user: req.user._id };
    
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
          amount: tx.amount,
          currency: tx.currency,
          status: tx.status,
          description: tx.description,
          balanceAfter: tx.balanceAfter,
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
          totalPages: Math.ceil(totalCount / parseInt(limit)),
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
        message: `Ya tiene un código OTP activo. Expira en ${Math.ceil(existingOtp.timeRemaining / 60)} minutos.`,
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
 * POST /api/me/withdrawals
 * Request a new withdrawal
 */
router.post('/withdrawals', withdrawalLimiter, async (req, res) => {
  try {
    // Validate request body
    const validatedData = withdrawalRequestSchema.parse(req.body);
    const { amount, currency, destinationAddress, network, pin } = validatedData;
    
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
    const availableBalance = user.balances[currency]?.available || 0;
    if (availableBalance < amount) {
      return res.status(400).json({
        success: false,
        message: `Saldo insuficiente. Disponible: ${availableBalance} ${currency}`,
        code: 'INSUFFICIENT_BALANCE'
      });
    }
    
    // Check for pending withdrawals
    const pendingWithdrawal = await Withdrawal.findOne({
      user: user._id,
      status: { $in: ['pending', 'approved', 'processing'] }
    });
    
    if (pendingWithdrawal) {
      return res.status(400).json({
        success: false,
        message: 'Ya tienes un retiro pendiente. Espera a que se complete.',
        code: 'PENDING_WITHDRAWAL_EXISTS'
      });
    }
    
    // Validate OTP PIN
    const otpValidation = otpService.validateOtp(user._id, pin, 'withdrawal');
    
    if (!otpValidation.valid) {
      return res.status(400).json({
        success: false,
        message: otpValidation.message,
        code: otpValidation.error,
        data: {
          remainingAttempts: otpValidation.remainingAttempts
        }
      });
    }
    
    // Create withdrawal request
    const withdrawal = await Withdrawal.createWithdrawal(
      user._id,
      amount,
      currency,
      destinationAddress,
      network
    );
    
    // Update user balance (reserve the amount)
    await user.updateBalance(currency, -amount, 'withdrawal_reserved');
    
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
      message: 'Solicitud de retiro creada exitosamente',
      data: {
        withdrawal: {
          withdrawalId: withdrawal.withdrawalId,
          amount: withdrawal.amount,
          currency: withdrawal.currency,
          destinationAddress: withdrawal.destinationAddress,
          network: withdrawal.network,
          status: withdrawal.status,
          estimatedFee: withdrawal.estimatedFee,
          netAmount: withdrawal.netAmount,
          createdAt: withdrawal.createdAt
        }
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
 * Get user withdrawal history
 */
router.get('/withdrawals', async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    
    // Build filter
    const filter = { user: req.user._id };
    
    if (status) {
      filter.status = status;
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get withdrawals
    const withdrawals = await Withdrawal.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count
    const totalCount = await Withdrawal.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        withdrawals: withdrawals.map(withdrawal => ({
          withdrawalId: withdrawal.withdrawalId,
          amount: withdrawal.amount,
          currency: withdrawal.currency,
          destinationAddress: withdrawal.destinationAddress,
          network: withdrawal.network,
          status: withdrawal.status,
          estimatedFee: withdrawal.estimatedFee,
          actualFee: withdrawal.actualFee,
          netAmount: withdrawal.netAmount,
          transactionHash: withdrawal.transactionHash,
          adminNotes: withdrawal.adminNotes,
          errorMessage: withdrawal.errorMessage,
          createdAt: withdrawal.createdAt,
          approvedAt: withdrawal.approvedAt,
          completedAt: withdrawal.completedAt,
          rejectedAt: withdrawal.rejectedAt
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + withdrawals.length < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    logger.error('Get user withdrawals error:', {
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
router.get('/commissions', async (req, res) => {
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
          commissionAmount: commission.commissionAmount,
          currency: commission.currency,
          status: commission.status,
          referredUser: {
            userId: commission.referredUser.userId,
            email: commission.referredUser.email,
            fullName: `${commission.referredUser.firstName} ${commission.referredUser.lastName}`
          },
          relatedPurchase: {
            purchaseId: commission.relatedPurchase.purchaseId,
            amount: commission.relatedPurchase.totalAmount
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
          totalPages: Math.ceil(totalCount / parseInt(limit)),
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

module.exports = router;