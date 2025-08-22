/**
 * Withdrawal Management Routes
 * Administrative routes for managing user withdrawals
 */

const express = require('express');
const { z } = require('zod');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { adminLimiter } = require('../middleware/rateLimiter');
const { auditMiddleware, captureOriginalState } = require('../middleware/audit');
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const telegramService = require('../services/telegram');
const { DecimalCalc } = require('../utils/decimal');
const logger = require('../config/logger');
const mongoose = require('mongoose');
const transactionService = require('../services/transactionService');
const realtimeSyncService = require('../services/realtimeSyncService');
const { middleware: responseStandardizer } = require('../middleware/responseStandardizer');

const router = express.Router();



// Apply admin authentication to all routes
router.use(authenticateToken, requireAdmin);

// Validation schemas
const approveWithdrawalSchema = z.object({
  withdrawalId: z.string().min(1, 'ID de retiro requerido'),
  adminNotes: z.string().optional(),
  processingTargetMinutes: z.number().min(0).optional()
});

const rejectWithdrawalSchema = z.object({
  withdrawalId: z.string().min(1, 'ID de retiro requerido'),
  reason: z.string().min(1, 'Motivo de rechazo requerido'),
  adminNotes: z.string().optional()
});

const completeWithdrawalSchema = z.object({
  withdrawalId: z.string().min(1, 'ID de retiro requerido'),
  txHash: z.string().min(1, 'Hash de transacción requerido'),
  adminNotes: z.string().optional()
});

/**
 * GET /api/admin/withdrawals
 * Get paginated list of withdrawals with filtering
 */
router.get('/', responseStandardizer, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      currency,
      network,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = DecimalCalc.max(1, parseInt(page));
    const limitNum = DecimalCalc.min(100, DecimalCalc.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const filter = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (currency) {
      filter.currency = currency;
    }
    
    if (network) {
      filter.network = network;
    }

    // Build aggregation pipeline
    const pipeline = [
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      }
    ];

    // Add search filter
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { 'user.email': { $regex: search, $options: 'i' } },
            { 'user.firstName': { $regex: search, $options: 'i' } },
            { 'user.lastName': { $regex: search, $options: 'i' } },
            { destinationAddress: { $regex: search, $options: 'i' } },
            { txHash: { $regex: search, $options: 'i' } }
          ]
        }
      });
    }

    // Add status/currency/network filters
    if (Object.keys(filter).length > 0) {
      pipeline.push({ $match: filter });
    }

    // Add sorting
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    pipeline.push({
      $sort: { [sortBy]: sortDirection }
    });

    // Get total count
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await Withdrawal.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    // Add pagination
    pipeline.push(
      { $skip: skip },
      { $limit: limitNum }
    );

    // Add projection with normalized field names
    pipeline.push({
      $project: {
        _id: 1,
        withdrawalId: 1,
        id: '$withdrawalId', // Canonical id field
        amountUSDT: '$amount', // Normalized amount field
        amount: 1, // Keep for legacy compatibility
        currency: 1,
        network: 1,
        destinationAddress: 1,
        toAddress: '$destinationAddress', // Canonical address field
        status: { $toUpper: '$status' }, // Normalize to uppercase
        txHash: 1,
        txId: '$txHash', // Canonical tx field
        adminNotes: 1,
        rejectionReason: 1,
        createdAt: 1,
        updatedAt: 1,
        approvedAt: 1,
        completedAt: 1,
        'user._id': 1,
        'user.email': 1,
        'user.firstName': 1,
        'user.lastName': 1,
        'user.telegramChatId': 1
      }
    });

    const withdrawals = await Withdrawal.aggregate(pipeline);

    const totalPages = DecimalCalc.round(total / limitNum);

    res.success({
      withdrawals,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: total,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      },
      filters: {
        status,
        currency,
        network,
        search
      }
    });

  } catch (error) {
    logger.error('Get withdrawals error:', {
      error: error.message,
      stack: error.stack,
      adminId: req.user?.userId,
      query: req.query
    });

    res.error('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
});

/**
 * GET /api/admin/withdrawals/:withdrawalId
 * Get detailed withdrawal information
 */
router.get('/:withdrawalId', async (req, res) => {
  try {
    const { withdrawalId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(withdrawalId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de retiro inválido',
        code: 'INVALID_WITHDRAWAL_ID'
      });
    }

    const withdrawal = await Withdrawal.findById(withdrawalId)
      .populate('userId', 'email firstName lastName telegramChatId balances')
      .lean();

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Retiro no encontrado',
        code: 'WITHDRAWAL_NOT_FOUND'
      });
    }

    // Normalize withdrawal response
    const normalizedWithdrawal = {
      ...withdrawal,
      id: withdrawal.withdrawalId || withdrawal._id.toString(),
      amountUSDT: withdrawal.amount,
      toAddress: withdrawal.destinationAddress,
      status: withdrawal.status?.toUpperCase() || 'REQUESTED',
      txId: withdrawal.txHash
    };

    res.json({
      success: true,
      data: { withdrawal: normalizedWithdrawal }
    });

  } catch (error) {
    logger.error('Get withdrawal details error:', {
      error: error.message,
      withdrawalId: req.params.withdrawalId,
      adminId: req.user?.userId
    });

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/admin/withdrawals/approve
 * Approve a withdrawal request
 */
router.post('/approve', 
  captureOriginalState(Withdrawal, 'withdrawalId'),
  auditMiddleware.withdrawalAction,
  responseStandardizer,
  async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    const validatedData = approveWithdrawalSchema.parse(req.body);
    const { withdrawalId, adminNotes, processingTargetMinutes } = validatedData;

    if (!mongoose.Types.ObjectId.isValid(withdrawalId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de retiro inválido',
        code: 'INVALID_WITHDRAWAL_ID'
      });
    }

    await session.withTransaction(async () => {
      // Get withdrawal with user data
      const withdrawal = await Withdrawal.findById(withdrawalId)
        .populate('userId')
        .session(session);

      if (!withdrawal) {
        throw new Error('WITHDRAWAL_NOT_FOUND');
      }

      // Check idempotency - if already approved, return success without changes
      if (withdrawal.status === 'approved') {
        logger.info('Withdrawal already approved - idempotent response', {
          withdrawalId,
          adminId: req.user.userId,
          originalApprovedAt: withdrawal.approvedAt
        });
        
        return res.json({
          success: true,
          message: 'Retiro ya aprobado previamente',
          data: {
            withdrawalId,
            status: 'approved',
            approvedAt: withdrawal.approvedAt,
            idempotent: true
          }
        });
      }

      if (withdrawal.status !== 'pending') {
        throw new Error('WITHDRAWAL_NOT_PENDING');
      }

      // Update withdrawal status
      withdrawal.status = 'approved';
      withdrawal.approvedAt = new Date();
      withdrawal.approvedBy = req.user.userId;
      if (adminNotes) {
        withdrawal.adminNotes = adminNotes;
      }
      
      // Set processing target and ETA if provided
      if (processingTargetMinutes) {
        withdrawal.processingTargetMinutes = processingTargetMinutes;
        withdrawal.processingETA = new Date(Date.now() + DecimalCalc.multiply(processingTargetMinutes, 60 * 1000));
      }

      await withdrawal.save({ session });

      // Emit real-time events
      realtimeSyncService.emitUserUpdate(withdrawal.userId._id, {
        type: 'withdrawal_approved',
        withdrawalId,
        status: 'approved',
        approvedAt: withdrawal.approvedAt
      });
      
      realtimeSyncService.emitAdminUpdate({
        type: 'withdrawal_status_changed',
        withdrawalId,
        status: 'approved',
        approvedBy: req.user.userId
      });

      logger.info('Withdrawal approved by admin', {
        withdrawalId,
        userId: withdrawal.userId._id,
        amount: withdrawal.amount,
        currency: withdrawal.currency,
        adminId: req.user.userId,
        adminNotes,
        processingTargetMinutes,
        processingETA: withdrawal.processingETA
      });

      // Send Telegram notification
      if (withdrawal.userId.telegramChatId) {
        try {
          await telegramService.sendWithdrawalNotification(
            withdrawal.userId.telegramChatId,
            withdrawal,
            'approved'
          );
        } catch (telegramError) {
          logger.warn('Failed to send Telegram notification for withdrawal approval', {
            withdrawalId,
            userId: withdrawal.userId._id,
            error: telegramError.message
          });
        }
      }
    });

    res.success({
      withdrawalId,
      status: 'approved',
      approvedAt: new Date().toISOString()
    }, 'Retiro aprobado exitosamente');

  } catch (error) {
    await session.abortTransaction();
    
    if (error.message === 'WITHDRAWAL_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Retiro no encontrado',
        code: 'WITHDRAWAL_NOT_FOUND'
      });
    }
    
    if (error.message === 'WITHDRAWAL_NOT_PENDING') {
      return res.status(400).json({
        success: false,
        message: 'El retiro no está en estado pendiente',
        code: 'WITHDRAWAL_NOT_PENDING'
      });
    }

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        code: 'VALIDATION_ERROR',
        errors: error.errors
      });
    }

    logger.error('Approve withdrawal error:', {
      error: error.message,
      stack: error.stack,
      withdrawalId: req.body.withdrawalId,
      adminId: req.user?.userId
    });

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  } finally {
    await session.endSession();
  }
});

/**
 * POST /api/admin/withdrawals/reject
 * Reject a withdrawal request and return funds
 */
router.post('/reject', 
  captureOriginalState(Withdrawal, 'withdrawalId'),
  auditMiddleware.withdrawalAction,
  async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    const validatedData = rejectWithdrawalSchema.parse(req.body);
    const { withdrawalId, reason, adminNotes } = validatedData;

    if (!mongoose.Types.ObjectId.isValid(withdrawalId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de retiro inválido',
        code: 'INVALID_WITHDRAWAL_ID'
      });
    }

    await session.withTransaction(async () => {
      // Get withdrawal with user data
      const withdrawal = await Withdrawal.findById(withdrawalId)
        .populate('userId')
        .session(session);

      if (!withdrawal) {
        throw new Error('WITHDRAWAL_NOT_FOUND');
      }

      // Check idempotency - if already rejected, return success without changes
      if (withdrawal.status === 'rejected') {
        logger.info('Withdrawal already rejected - idempotent response', {
          withdrawalId,
          adminId: req.user.userId,
          originalRejectedAt: withdrawal.rejectedAt
        });
        
        return res.json({
          success: true,
          message: 'Retiro ya rechazado previamente',
          data: {
            withdrawalId,
            status: 'rejected',
            rejectedAt: withdrawal.rejectedAt,
            idempotent: true
          }
        });
      }

      if (!['pending', 'approved'].includes(withdrawal.status)) {
        throw new Error('WITHDRAWAL_CANNOT_BE_REJECTED');
      }

      // Return funds to user balance
      const user = withdrawal.userId;
      const balanceField = `balances.${withdrawal.currency.toLowerCase()}.available`;
      
      await User.findByIdAndUpdate(
        user._id,
        {
          $inc: { [balanceField]: withdrawal.amount }
        },
        { session }
      );

      // Create transaction record for returned funds
      const transaction = new Transaction({
        userId: user._id,
        type: 'withdrawal_refund',
        amount: withdrawal.amount,
        currency: withdrawal.currency,
        status: 'completed',
        description: `Fondos devueltos por rechazo de retiro: ${reason}`,
        metadata: {
          withdrawalId: withdrawal._id,
          rejectionReason: reason,
          adminId: req.user.userId
        }
      });

      await transaction.save({ session });

      // Update withdrawal status
      withdrawal.status = 'rejected';
      withdrawal.rejectedAt = new Date();
      withdrawal.rejectedBy = req.user.userId;
      withdrawal.rejectionReason = reason;
      if (adminNotes) {
        withdrawal.adminNotes = adminNotes;
      }

      await withdrawal.save({ session });

      logger.info('Withdrawal rejected by admin', {
        withdrawalId,
        userId: user._id,
        amount: withdrawal.amount,
        currency: withdrawal.currency,
        reason,
        adminId: req.user.userId,
        transactionId: transaction._id
      });

      // Send Telegram notification
      if (user.telegramChatId) {
        try {
          await telegramService.sendWithdrawalNotification(
            user.telegramChatId,
            withdrawal,
            'rejected'
          );
        } catch (telegramError) {
          logger.warn('Failed to send Telegram notification for withdrawal rejection', {
            withdrawalId,
            userId: user._id,
            error: telegramError.message
          });
        }
      }
    });

    res.json({
      success: true,
      message: 'Retiro rechazado y fondos devueltos exitosamente',
      data: {
        withdrawalId,
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
        reason
      }
    });

  } catch (error) {
    await session.abortTransaction();
    
    if (error.message === 'WITHDRAWAL_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Retiro no encontrado',
        code: 'WITHDRAWAL_NOT_FOUND'
      });
    }
    
    if (error.message === 'WITHDRAWAL_CANNOT_BE_REJECTED') {
      return res.status(400).json({
        success: false,
        message: 'El retiro no puede ser rechazado en su estado actual',
        code: 'WITHDRAWAL_CANNOT_BE_REJECTED'
      });
    }

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        code: 'VALIDATION_ERROR',
        errors: error.errors
      });
    }

    logger.error('Reject withdrawal error:', {
      error: error.message,
      stack: error.stack,
      withdrawalId: req.body.withdrawalId,
      adminId: req.user?.userId
    });

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  } finally {
    await session.endSession();
  }
});

/**
 * POST /api/admin/withdrawals/complete
 * Mark withdrawal as completed with transaction hash
 */
router.post('/complete', 
  captureOriginalState(Withdrawal, 'withdrawalId'),
  auditMiddleware.withdrawalAction,
  async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    const validatedData = completeWithdrawalSchema.parse(req.body);
    const { withdrawalId, txHash, adminNotes } = validatedData;

    if (!mongoose.Types.ObjectId.isValid(withdrawalId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de retiro inválido',
        code: 'INVALID_WITHDRAWAL_ID'
      });
    }

    await session.withTransaction(async () => {
      // Get withdrawal with user data
      const withdrawal = await Withdrawal.findById(withdrawalId)
        .populate('userId')
        .session(session);

      if (!withdrawal) {
        throw new Error('WITHDRAWAL_NOT_FOUND');
      }

      // Check idempotency - if already completed, return success without changes
      if (withdrawal.status === 'completed') {
        logger.info('Withdrawal already completed - idempotent response', {
          withdrawalId,
          adminId: req.user.userId,
          originalCompletedAt: withdrawal.completedAt,
          existingTxHash: withdrawal.txHash
        });
        
        return res.json({
          success: true,
          message: 'Retiro ya completado previamente',
          data: {
            withdrawalId,
            status: 'completed',
            completedAt: withdrawal.completedAt,
            txHash: withdrawal.txHash,
            idempotent: true
          }
        });
      }

      if (withdrawal.status !== 'approved') {
        throw new Error('WITHDRAWAL_NOT_APPROVED');
      }

      // Check if txHash already exists
      const existingWithdrawal = await Withdrawal.findOne({
        txHash,
        _id: { $ne: withdrawalId }
      }).session(session);

      if (existingWithdrawal) {
        throw new Error('TX_HASH_ALREADY_EXISTS');
      }

      // Create transaction record for completed withdrawal
      const transaction = new Transaction({
        userId: withdrawal.userId._id,
        type: 'withdrawal_completed',
        amount: withdrawal.amount,
        currency: withdrawal.currency,
        status: 'completed',
        description: `Retiro completado - ${withdrawal.network}`,
        txHash,
        metadata: {
          withdrawalId: withdrawal._id,
          network: withdrawal.network,
          destinationAddress: withdrawal.destinationAddress,
          adminId: req.user.userId
        }
      });

      await transaction.save({ session });

      // Update withdrawal status
      withdrawal.status = 'completed';
      withdrawal.completedAt = new Date();
      withdrawal.completedBy = req.user.userId;
      withdrawal.txHash = txHash;
      if (adminNotes) {
        withdrawal.adminNotes = adminNotes;
      }

      await withdrawal.save({ session });

      logger.info('Withdrawal completed by admin', {
        withdrawalId,
        userId: withdrawal.userId._id,
        amount: withdrawal.amount,
        currency: withdrawal.currency,
        txHash,
        adminId: req.user.userId,
        transactionId: transaction._id
      });

      // Send Telegram notification
      if (withdrawal.userId.telegramChatId) {
        try {
          await telegramService.sendWithdrawalNotification(
            withdrawal.userId.telegramChatId,
            withdrawal,
            'completed'
          );
        } catch (telegramError) {
          logger.warn('Failed to send Telegram notification for withdrawal completion', {
            withdrawalId,
            userId: withdrawal.userId._id,
            error: telegramError.message
          });
        }
      }
    });

    res.json({
      success: true,
      message: 'Retiro marcado como completado exitosamente',
      data: {
        withdrawalId,
        status: 'completed',
        completedAt: new Date().toISOString(),
        txHash
      }
    });

  } catch (error) {
    await session.abortTransaction();
    
    if (error.message === 'WITHDRAWAL_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Retiro no encontrado',
        code: 'WITHDRAWAL_NOT_FOUND'
      });
    }
    
    if (error.message === 'WITHDRAWAL_NOT_APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'El retiro no está aprobado',
        code: 'WITHDRAWAL_NOT_APPROVED'
      });
    }
    
    if (error.message === 'TX_HASH_ALREADY_EXISTS') {
      return res.status(400).json({
        success: false,
        message: 'El hash de transacción ya existe',
        code: 'TX_HASH_ALREADY_EXISTS'
      });
    }

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        code: 'VALIDATION_ERROR',
        errors: error.errors
      });
    }

    logger.error('Complete withdrawal error:', {
      error: error.message,
      stack: error.stack,
      withdrawalId: req.body.withdrawalId,
      adminId: req.user?.userId
    });

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  } finally {
    await session.endSession();
  }
});

/**
 * GET /api/admin/withdrawals/stats
 * Get withdrawal statistics
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await Withdrawal.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const currencyStats = await Withdrawal.aggregate([
      {
        $group: {
          _id: '$currency',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const networkStats = await Withdrawal.aggregate([
      {
        $group: {
          _id: '$network',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - DecimalCalc.multiply(30, 24 * 60 * 60 * 1000));
    const recentStats = await Withdrawal.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
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

    res.json({
      success: true,
      data: {
        byStatus: stats,
        byCurrency: currencyStats,
        byNetwork: networkStats,
        recent30Days: recentStats,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Get withdrawal stats error:', {
      error: error.message,
      adminId: req.user?.userId
    });

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * PATCH /api/admin/withdrawals/:id/approve
 * Approve a withdrawal request (RESTful endpoint)
 */
router.patch('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { eta, adminNotes } = req.body;
    
    const withdrawal = await Withdrawal.findOne({ withdrawalId: id }).populate('userId');
    
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Retiro no encontrado',
        code: 'WITHDRAWAL_NOT_FOUND'
      });
    }
    
    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'El retiro no está en estado pendiente',
        code: 'WITHDRAWAL_NOT_PENDING'
      });
    }
    
    withdrawal.status = 'approved';
    withdrawal.approvedAt = new Date();
    withdrawal.approvedBy = req.user._id;
    
    if (eta) {
      withdrawal.processingETA = new Date(eta);
    }
    
    if (adminNotes) {
      withdrawal.adminNotes = adminNotes;
    }
    
    await withdrawal.save();
    
    logger.info('Withdrawal approved via PATCH', {
      withdrawalId: id,
      adminId: req.user.userId,
      eta,
      adminNotes
    });
    
    res.json({ success: true });
    
  } catch (error) {
    logger.error('PATCH approve withdrawal error:', {
      error: error.message,
      withdrawalId: req.params.id,
      adminId: req.user?.userId
    });
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * PATCH /api/admin/withdrawals/:id/reject
 * Reject a withdrawal request (RESTful endpoint)
 */
router.patch('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, adminNotes } = req.body;
    
    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Motivo de rechazo requerido',
        code: 'REASON_REQUIRED'
      });
    }
    
    const withdrawal = await Withdrawal.findOne({ withdrawalId: id }).populate('userId');
    
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Retiro no encontrado',
        code: 'WITHDRAWAL_NOT_FOUND'
      });
    }
    
    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'El retiro no está en estado pendiente',
        code: 'WITHDRAWAL_NOT_PENDING'
      });
    }
    
    withdrawal.status = 'rejected';
    withdrawal.rejectedAt = new Date();
    withdrawal.rejectedBy = req.user.userId;
    withdrawal.rejectionReason = reason;
    
    if (adminNotes) {
      withdrawal.adminNotes = adminNotes;
    }
    
    await withdrawal.save();
    
    logger.info('Withdrawal rejected via PATCH', {
      withdrawalId: id,
      adminId: req.user.userId,
      reason,
      adminNotes
    });
    
    res.json({ success: true });
    
  } catch (error) {
    logger.error('PATCH reject withdrawal error:', {
      error: error.message,
      withdrawalId: req.params.id,
      adminId: req.user?.userId
    });
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * PATCH /api/admin/withdrawals/:id/mark-paid
 * Mark a withdrawal as paid (RESTful endpoint)
 */
router.patch('/:id/mark-paid', async (req, res) => {
  try {
    const { id } = req.params;
    const { txHash, paidAt, adminNotes } = req.body;
    
    if (!txHash) {
      return res.status(400).json({
        success: false,
        message: 'Hash de transacción requerido',
        code: 'TX_HASH_REQUIRED'
      });
    }
    
    const withdrawal = await Withdrawal.findOne({ withdrawalId: id }).populate('userId');
    
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Retiro no encontrado',
        code: 'WITHDRAWAL_NOT_FOUND'
      });
    }
    
    if (withdrawal.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'El retiro debe estar aprobado para marcarlo como pagado',
        code: 'WITHDRAWAL_NOT_APPROVED'
      });
    }
    
    withdrawal.status = 'PAID'; // Normalized to uppercase
    withdrawal.completedAt = paidAt ? new Date(paidAt) : new Date();
    withdrawal.txHash = txHash;
    withdrawal.processedBy = req.user._id; // Keep for legacy compatibility
    withdrawal.processedByUserId = req.user.userId; // New canonical field (USR_...)
    
    if (adminNotes) {
      withdrawal.adminNotes = adminNotes;
    }
    
    // Create negative ledger entry for withdrawal
    const Ledger = require('../models/Ledger');
    await Ledger.create({
      userId: withdrawal.userId._id,
      type: 'WITHDRAWAL',
      amount: -Math.abs(withdrawal.amount), // Ensure negative
      currency: 'USDT',
      description: `Withdrawal paid - ${txHash}`,
      referenceId: withdrawal.withdrawalId,
      referenceType: 'Withdrawal',
      metadata: {
        txHash,
        processedBy: req.user.userId,
        paidAt: withdrawal.completedAt
      }
    });
    
    await withdrawal.save();
    
    logger.info('Withdrawal marked as paid via PATCH', {
      withdrawalId: id,
      adminId: req.user.userId,
      txHash,
      paidAt,
      adminNotes
    });
    
    res.json({ success: true });
    
  } catch (error) {
    logger.error('PATCH mark-paid withdrawal error:', {
      error: error.message,
      stack: error.stack,
      withdrawalId: req.params.id,
      adminId: req.user?.userId,
      requestBody: req.body
    });
    
    console.error('Full error details:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;