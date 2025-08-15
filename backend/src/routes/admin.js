/**
 * Admin Routes
 * Handles administrative functions for payment confirmations and system management
 */

const express = require('express');
const { z } = require('zod');
const { Purchase, User, Commission, Transaction, Package, Wallet } = require('../models');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const logger = require('../config/logger');

const router = express.Router();

// Apply admin authentication to all routes
router.use(authenticateToken, requireAdmin);

// Validation schemas
const confirmPaymentSchema = z.object({
  purchaseId: z.string().min(1, 'Purchase ID es requerido'),
  action: z.enum(['confirm', 'reject'], {
    errorMap: () => ({ message: 'Acción debe ser confirm o reject' })
  }),
  notes: z.string().optional()
});

/**
 * GET /api/admin/payments/pending
 * Get all pending payments for review
 */
router.get('/payments/pending', async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    
    // Build filter
    const filter = { status: 'hash_submitted' };
    
    // Add search functionality
    if (search) {
      filter.$or = [
        { purchaseId: { $regex: search, $options: 'i' } },
        { transactionHash: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get pending purchases
    const purchases = await Purchase.find(filter)
      .populate('user', 'userId email firstName lastName')
      .populate('package', 'packageId name price currency')
      .populate('assignedWallet', 'walletId address network')
      .sort({ hashSubmittedAt: 1 }) // Oldest first
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count
    const totalCount = await Purchase.countDocuments(filter);
    
    // Transform purchases for response
    const transformedPurchases = purchases.map(purchase => ({
      purchaseId: purchase.purchaseId,
      user: {
        userId: purchase.user.userId,
        email: purchase.user.email,
        fullName: `${purchase.user.firstName} ${purchase.user.lastName}`
      },
      package: {
        packageId: purchase.package.packageId,
        name: purchase.package.name,
        price: purchase.package.price
      },
      payment: {
        quantity: purchase.quantity,
        unitPrice: purchase.unitPrice,
        totalAmount: purchase.totalAmount,
        currency: purchase.currency,
        walletAddress: purchase.assignedWallet?.address,
        network: purchase.assignedWallet?.network
      },
      transaction: {
        hash: purchase.transactionHash,
        submittedAt: purchase.hashSubmittedAt
      },
      status: purchase.status,
      createdAt: purchase.createdAt,
      waitingTime: Math.floor((new Date() - purchase.hashSubmittedAt) / (1000 * 60)) // minutes
    }));
    
    res.json({
      success: true,
      data: {
        purchases: transformedPurchases,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + purchases.length < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    logger.error('Get pending payments error:', {
      error: error.message,
      adminId: req.user?.userId,
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
 * POST /api/admin/payments/confirm
 * Confirm or reject a payment
 */
router.post('/payments/confirm', async (req, res) => {
  try {
    // Validate request body
    const validatedData = confirmPaymentSchema.parse(req.body);
    const { purchaseId, action, notes } = validatedData;
    
    const admin = req.user;
    
    // Find the purchase
    const purchase = await Purchase.findOne({ purchaseId })
      .populate('user')
      .populate('package');
    
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Compra no encontrada',
        code: 'PURCHASE_NOT_FOUND'
      });
    }
    
    // Check if purchase is in correct status
    if (purchase.status !== 'hash_submitted') {
      return res.status(400).json({
        success: false,
        message: `La compra está en estado ${purchase.status}, no se puede procesar`,
        code: 'INVALID_PURCHASE_STATUS'
      });
    }
    
    if (action === 'confirm') {
      // Confirm the payment and activate the purchase
      await confirmPurchase(purchase, admin, notes);
      
      logger.info('Payment confirmed by admin', {
        adminId: admin.userId,
        purchaseId: purchase.purchaseId,
        userId: purchase.user.userId,
        amount: purchase.totalAmount,
        transactionHash: purchase.transactionHash
      });
      
      res.json({
        success: true,
        message: 'Pago confirmado y compra activada exitosamente',
        data: {
          purchaseId: purchase.purchaseId,
          status: 'confirmed',
          activatedAt: new Date()
        }
      });
      
    } else if (action === 'reject') {
      // Reject the payment
      purchase.status = 'rejected';
      purchase.rejectedAt = new Date();
      purchase.rejectedBy = admin._id;
      purchase.adminNotes = notes || 'Pago rechazado por el administrador';
      
      await purchase.save();
      
      // Release the assigned wallet
      if (purchase.assignedWallet) {
        const wallet = await Wallet.findById(purchase.assignedWallet);
        if (wallet) {
          await wallet.release();
        }
      }
      
      logger.info('Payment rejected by admin', {
        adminId: admin.userId,
        purchaseId: purchase.purchaseId,
        userId: purchase.user.userId,
        reason: notes,
        transactionHash: purchase.transactionHash
      });
      
      res.json({
        success: true,
        message: 'Pago rechazado exitosamente',
        data: {
          purchaseId: purchase.purchaseId,
          status: 'rejected',
          rejectedAt: purchase.rejectedAt
        }
      });
    }
    
  } catch (error) {
    logger.error('Confirm payment error:', {
      error: error.message,
      stack: error.stack,
      adminId: req.user?.userId,
      body: req.body,
      ip: req.ip
    });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Datos de confirmación inválidos',
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
 * Helper function to confirm purchase and create commissions
 */
async function confirmPurchase(purchase, admin, notes) {
  // Start transaction session for atomicity
  const session = await Purchase.startSession();
  
  try {
    await session.withTransaction(async () => {
      // Activate the purchase
      await purchase.activate();
      
      // Update purchase with admin info
      purchase.confirmedBy = admin._id;
      purchase.adminNotes = notes;
      await purchase.save({ session });
      
      // Create benefit transaction
      await Transaction.createBenefitTransaction(
        purchase.user._id,
        0, // Initial benefit amount is 0
        purchase.currency,
        purchase._id,
        'Purchase activated - benefits will start processing',
        session
      );
      
      // Create commissions for referral chain
      await createCommissions(purchase, session);
      
      // Update package statistics
      await Package.findByIdAndUpdate(
        purchase.package._id,
        {
          $inc: {
            purchaseCount: 1,
            totalRevenue: purchase.totalAmount
          }
        },
        { session }
      );
      
      // Release the assigned wallet
      if (purchase.assignedWallet) {
        const wallet = await Wallet.findById(purchase.assignedWallet).session(session);
        if (wallet) {
          await wallet.release();
        }
      }
    });
    
  } finally {
    await session.endSession();
  }
}

/**
 * Helper function to create commissions for referral chain
 */
async function createCommissions(purchase, session) {
  const user = await User.findById(purchase.user._id).session(session);
  const package = await Package.findById(purchase.package._id).session(session);
  
  if (!user.referredBy) {
    logger.debug('User has no referrer, skipping commission creation', {
      userId: user.userId,
      purchaseId: purchase.purchaseId
    });
    return;
  }
  
  // Build referral chain (up to 5 levels)
  const referralChain = [];
  let currentUser = user;
  
  for (let level = 1; level <= 5; level++) {
    if (!currentUser.referredBy) break;
    
    const referrer = await User.findById(currentUser.referredBy).session(session);
    if (!referrer || !referrer.isActive) break;
    
    referralChain.push({
      level,
      user: referrer,
      rate: package.commissionRates[`level${level}`] || 0
    });
    
    currentUser = referrer;
  }
  
  // Create commission records
  for (const chainItem of referralChain) {
    if (chainItem.rate > 0) {
      await Commission.createCommission(
        chainItem.user._id,
        user._id,
        purchase._id,
        package._id,
        chainItem.level,
        chainItem.rate,
        purchase.totalAmount,
        purchase.currency,
        referralChain.map(item => item.user._id),
        session
      );
    }
  }
  
  logger.info('Commissions created for purchase', {
    purchaseId: purchase.purchaseId,
    userId: user.userId,
    chainLength: referralChain.length,
    totalCommissionLevels: referralChain.filter(item => item.rate > 0).length
  });
}

/**
 * GET /api/admin/dashboard/stats
 * Get admin dashboard statistics
 */
router.get('/dashboard/stats', async (req, res) => {
  try {
    // Get various statistics
    const [purchaseStats, userStats, commissionStats, walletStats] = await Promise.all([
      // Purchase statistics
      Purchase.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' }
          }
        }
      ]),
      
      // User statistics
      User.aggregate([
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            activeUsers: {
              $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
            },
            verifiedUsers: {
              $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] }
            }
          }
        }
      ]),
      
      // Commission statistics
      Commission.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$commissionAmount' }
          }
        }
      ]),
      
      // Wallet statistics
      Wallet.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ])
    ]);
    
    // Transform statistics
    const stats = {
      purchases: {
        total: purchaseStats.reduce((sum, stat) => sum + stat.count, 0),
        byStatus: purchaseStats.reduce((acc, stat) => {
          acc[stat._id] = {
            count: stat.count,
            totalAmount: stat.totalAmount || 0
          };
          return acc;
        }, {}),
        totalRevenue: purchaseStats.reduce((sum, stat) => sum + (stat.totalAmount || 0), 0)
      },
      users: userStats[0] || {
        totalUsers: 0,
        activeUsers: 0,
        verifiedUsers: 0
      },
      commissions: {
        total: commissionStats.reduce((sum, stat) => sum + stat.count, 0),
        byStatus: commissionStats.reduce((acc, stat) => {
          acc[stat._id] = {
            count: stat.count,
            totalAmount: stat.totalAmount || 0
          };
          return acc;
        }, {}),
        totalAmount: commissionStats.reduce((sum, stat) => sum + (stat.totalAmount || 0), 0)
      },
      wallets: {
        total: walletStats.reduce((sum, stat) => sum + stat.count, 0),
        byStatus: walletStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {})
      }
    };
    
    res.json({
      success: true,
      data: { stats }
    });
    
  } catch (error) {
    logger.error('Get admin stats error:', {
      error: error.message,
      adminId: req.user?.userId,
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
 * GET /api/admin/users
 * Get users list with pagination and search
 */
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    
    // Build filter
    const filter = {};
    
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { userId: { $regex: search, $options: 'i' } },
        { referralCode: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      if (status === 'active') filter.isActive = true;
      if (status === 'inactive') filter.isActive = false;
      if (status === 'verified') filter.isVerified = true;
      if (status === 'unverified') filter.isVerified = false;
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get users
    const users = await User.find(filter)
      .select('-password -security.resetPasswordToken -security.resetPasswordExpires')
      .populate('referredBy', 'userId email firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count
    const totalCount = await User.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        users: users.map(user => ({
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
          referredBy: user.referredBy ? {
            userId: user.referredBy.userId,
            email: user.referredBy.email,
            fullName: `${user.referredBy.firstName} ${user.referredBy.lastName}`
          } : null,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + users.length < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    logger.error('Get users error:', {
      error: error.message,
      adminId: req.user?.userId,
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