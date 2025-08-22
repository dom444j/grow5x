/**
 * Admin Routes
 * Handles administrative functions for payment confirmations and system management
 */

const express = require('express');
const { z } = require('zod');
const { Purchase, User, Commission, Transaction, Package, Wallet, Withdrawal, Cohort } = require('../models');
const BenefitSchedule = require('../models/BenefitSchedule');
const BenefitLedger = require('../models/BenefitLedger');
const Ledger = require('../models/Ledger');
const { COMMISSIONS } = require('../config/commissions');
const dayjs = require('dayjs');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { auditMiddleware, captureOriginalState } = require('../middleware/audit');
const { adminLimiter } = require('../middleware/rateLimiter');
const { adminOverviewCache } = require('../middleware/cache');
const { validateWalletAddress, enforceUSDTBEP20Query } = require('../middleware/usdtBep20Hardening');
const { validateTransactionHash } = require('../middleware/validation');
const logger = require('../config/logger');
const JobState = require('../models/JobState');
const mongoose = require('mongoose');
const adminReportsRouter = require('./adminReports');
const cohortRoutes = require('./cohortRoutes');
const { toApiNumber, DecimalCalc } = require('../utils/decimal');
const userImportRoutes = require('./userImportRoutes');
const iamRoutes = require('./iamRoutes');
const ReferralController = require('../controllers/referralController');
const licensesController = require('../controllers/licensesController');
const PurchaseDTO = require('../dto/PurchaseDTO');
const { stateMapperMiddleware, mapPurchaseState } = require('../utils/stateMapper');
// Test alert routes removed after validation

// Health endpoint cache (10 seconds TTL)
let healthCache = {
  data: null,
  timestamp: 0,
  ttl: 10000 // 10 seconds
};

const router = express.Router();

// Endpoint temporal para obtener roles (sin autenticación)
router.get('/roles', async (req, res) => {
  try {
    const Role = require('../models/Role');
    const roles = await Role.getActiveRoles();
    
    const rolesForFrontend = roles.map(role => ({
      name: role.name,
      displayName: role.displayName
    }));
    
    res.json({
      success: true,
      data: rolesForFrontend
    });
    
  } catch (error) {
    logger.error('Error fetching roles:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Special Parent Status Management
const specialParentSchema = z.object({
  specialParentCode: z.string().min(1, 'Código especial padre es requerido'),
  notes: z.string().optional()
});

// Assign Special Parent Status
router.patch('/users/:id/assign-special-parent',
  captureOriginalState(User, 'id'),
  auditMiddleware.userChange('assign_special_parent'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const validation = specialParentSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          errors: validation.error.errors
        });
      }
      
      const { specialParentCode, notes } = validation.data;
      
      // Check if user exists
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }
      
      // Check if user already has special parent status
      if (user.specialParentStatus === 'special_parent') {
        return res.status(400).json({
          success: false,
          message: 'El usuario ya tiene estatus de padre especial'
        });
      }
      
      // Check if special parent code already exists
      const existingCode = await User.findOne({ specialParentCode });
      if (existingCode) {
        return res.status(400).json({
          success: false,
          message: 'El código especial padre ya existe'
        });
      }
      
      // Update user with special parent status
      user.specialParentStatus = 'special_parent';
      user.specialParentCode = specialParentCode;
      user.specialParentAssignedAt = new Date();
      user.specialParentAssignedBy = req.user.id;
      
      await user.save();
      
      logger.info(`Admin ${req.user.email} assigned special parent status to user ${user.email}`, {
        adminId: req.user.id,
        userId: user._id,
        specialParentCode,
        notes
      });
      
      res.json({
        success: true,
        message: 'Estatus de padre especial asignado exitosamente',
        data: {
          userId: user._id,
          email: user.email,
          specialParentStatus: user.specialParentStatus,
          specialParentCode: user.specialParentCode,
          assignedAt: user.specialParentAssignedAt
        }
      });
      
    } catch (error) {
      logger.error('Error assigning special parent status:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
);

// Remove Special Parent Status
router.patch('/users/:id/remove-special-parent',
  captureOriginalState(User, 'id'),
  auditMiddleware.userChange('remove_special_parent'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      
      // Check if user exists
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }
      
      // Check if user has special parent status
      if (user.specialParentStatus !== 'special_parent') {
        return res.status(400).json({
          success: false,
          message: 'El usuario no tiene estatus de padre especial'
        });
      }
      
      // Remove special parent status
      const oldCode = user.specialParentCode;
      user.specialParentStatus = 'none';
      user.specialParentCode = undefined;
      user.specialParentAssignedAt = undefined;
      user.specialParentAssignedBy = undefined;
      
      await user.save();
      
      logger.info(`Admin ${req.user.email} removed special parent status from user ${user.email}`, {
        adminId: req.user.id,
        userId: user._id,
        oldSpecialParentCode: oldCode,
        notes
      });
      
      res.json({
        success: true,
        message: 'Estatus de padre especial removido exitosamente',
        data: {
          userId: user._id,
          email: user.email,
          specialParentStatus: user.specialParentStatus
        }
      });
      
    } catch (error) {
      logger.error('Error removing special parent status:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
);

// Get Special Parent Users
router.get('/users/special-parents', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const skip = (page - 1) * limit;
    
    // Build search query
    const searchQuery = {
      specialParentStatus: 'special_parent'
    };
    
    if (search) {
      searchQuery.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { specialParentCode: { $regex: search, $options: 'i' } }
      ];
    }
    
    const [users, total] = await Promise.all([
      User.find(searchQuery)
        .populate('specialParentAssignedBy', 'firstName lastName email')
        .select('firstName lastName email specialParentCode specialParentAssignedAt specialParentAssignedBy isActive createdAt')
        .sort({ specialParentAssignedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(searchQuery)
    ]);
    
    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: DecimalCalc.round(total / limit)
      }
    });
    
  } catch (error) {
    logger.error('Error fetching special parent users:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Mount routes that need special authentication before applying global admin middleware
router.use('/import-jobs', authenticateToken, adminLimiter, userImportRoutes);

// Apply authentication and admin middleware to all other routes
router.use(authenticateToken, requireAdmin, adminLimiter);

// Mount admin reports routes
router.use('/reports', adminReportsRouter);
router.use('/cohorts', cohortRoutes);
router.use('/iam', iamRoutes);
// router.use('/daily-benefits', require('./admin/daily-benefits')); // Temporarily disabled due to import error

// Test alert routes removed after validation

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
router.get('/payments/pending', stateMapperMiddleware('purchase'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    
    // Build filter
    const filter = { status: 'CONFIRMING' };
    
    // Add search functionality
    if (search) {
      filter.$or = [
        { purchaseId: { $regex: search, $options: 'i' } },
        { txHash: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get pending purchases
    const purchases = await Purchase.find(filter)
      .populate('userId', 'userId email firstName lastName')
      .populate('packageId', 'packageId name price currency')
      .populate('assignedWallet', 'walletId address network')
      .sort({ hashSubmittedAt: 1 }) // Oldest first
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count
    const totalCount = await Purchase.countDocuments(filter);
    
    // Transform purchases for response using PurchaseDTO
    const transformedPurchases = purchases.map(purchase => {
      const dto = PurchaseDTO.forAdmin(purchase);
      // Override status with mapped state if available
      if (req.mappedStates?.purchase?.status) {
        dto.status = req.mappedStates.purchase.status;
      }
      // Add waiting time calculation for admin view
      if (purchase.hashSubmittedAt) {
        dto.waitingTime = DecimalCalc.round((new Date() - purchase.hashSubmittedAt) / (1000 * 60)); // minutes
      }
      return dto;
    });
    
    res.json({
      success: true,
      data: {
        purchases: transformedPurchases,
        pagination: {
          currentPage: parseInt(page),
          totalPages: DecimalCalc.round(totalCount / parseInt(limit)),
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
 * GET /api/admin/purchases/test
 * Test endpoint to debug issues
 */
router.get('/purchases/test', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Test endpoint working'
    });
  } catch (error) {
    console.error('Test error:', error);
    res.status(500).json({
      success: false,
      message: 'Test failed'
    });
  }
});

/**
 * GET /api/admin/purchases/all
 * Get all purchases with filtering by status
 */
router.get('/purchases/all', stateMapperMiddleware('purchase'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      userId,
      packageId,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = {};
    
    if (status) {
      if (Array.isArray(status)) {
        filter.status = { $in: status };
      } else {
        filter.status = status;
      }
    }
    
    if (userId) {
      const user = await User.findOne({ userId });
      if (user) {
        filter.userId = user._id;
      }
    }
    
    if (packageId) {
      const pkg = await Package.findOne({ packageId });
      if (pkg) {
        filter.packageId = pkg._id;
      }
    }
    
    if (search) {
      filter.$or = [
        { purchaseId: { $regex: search, $options: 'i' } },
        { txHash: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get purchases
    const purchases = await Purchase.find(filter)
      .populate('userId', '_id userId email firstName lastName')
      .populate('packageId', '_id packageId name price currency')
      .populate('assignedWallet', '_id walletId address network')
      .populate('confirmedBy', '_id userId firstName lastName')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const totalCount = await Purchase.countDocuments(filter);

    // Transform purchases for response using PurchaseDTO
    const transformedPurchases = purchases.map(purchase => {
      const dto = PurchaseDTO.forAdmin(purchase);
      // Add waiting time calculation for admin view
      if (purchase.paymentSubmittedAt) {
        dto.waitingTime = DecimalCalc.round((new Date() - purchase.paymentSubmittedAt) / (1000 * 60)); // minutes
      }
      return dto;
    });

    res.json({
      success: true,
      data: {
        purchases: transformedPurchases,
        pagination: {
          currentPage: parseInt(page),
          totalPages: DecimalCalc.round(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + purchases.length < totalCount,
          hasPrev: parseInt(page) > 1
        },
        filters: {
          status,
          search,
          userId,
          packageId,
          sortBy,
          sortOrder
        }
      }
    });

  } catch (error) {
    console.error('Get purchases error:', error.message);
    console.error('Stack trace:', error.stack);
    logger.error('Get purchases error:', {
      error: error.message,
      stack: error.stack,
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
router.post('/payments/confirm', 
  captureOriginalState(Purchase, 'purchaseId'),
  auditMiddleware.paymentAction,
  async (req, res) => {
  try {
    // Validate request body
    const validatedData = confirmPaymentSchema.parse(req.body);
    const { purchaseId, action, notes } = validatedData;
    
    const admin = req.user;
    
    // Find the purchase
    const purchase = await Purchase.findOne({ purchaseId })
      .populate('userId', '_id userId email firstName lastName')
      .populate('packageId', '_id packageId name price currency');
    
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Compra no encontrada',
        code: 'PURCHASE_NOT_FOUND'
      });
    }
    
    // Check if purchase is in correct status
    if (purchase.status !== 'CONFIRMING') {
      return res.status(400).json({
        success: false,
        message: `La compra está en estado ${purchase.status}, no se puede procesar`,
        code: 'INVALID_PURCHASE_STATUS'
      });
    }
    
    if (action === 'confirm') {
      // Check idempotency - if already approved/active, return success without changes
      if (purchase.status === 'APPROVED' || purchase.status === 'ACTIVE') {
        logger.info('Payment already confirmed - idempotent response', {
          adminId: admin.userId,
          purchaseId: purchase.purchaseId,
          originalConfirmedAt: purchase.paymentConfirmedAt
        });
        
        return res.json({
          success: true,
          message: 'Pago ya confirmado previamente',
          data: {
            purchaseId: purchase.purchaseId,
            status: mapPurchaseState(purchase.status),
            confirmedAt: purchase.paymentConfirmedAt,
            idempotent: true
          }
        });
      }
      
      // Approve the payment and activate the purchase
      await confirmPurchase(purchase, admin, notes);
      
      logger.info('Payment confirmed by admin', {
        adminId: admin.userId,
        purchaseId: purchase.purchaseId,
        userId: purchase.userId.userId,
        amount: purchase.totalAmount,
        transactionHash: purchase.txHash
      });
      
      res.json({
        success: true,
        message: 'Pago confirmado y compra activada exitosamente',
        data: {
          purchaseId: purchase.purchaseId,
          status: mapPurchaseState('ACTIVE'),
          activatedAt: new Date()
        }
      });
      
    } else if (action === 'reject') {
      // Check idempotency - if already rejected, return success without changes
      if (purchase.status === 'REJECTED') {
        logger.info('Payment already rejected - idempotent response', {
          adminId: admin.userId,
          purchaseId: purchase.purchaseId,
          originalRejectedAt: purchase.rejectedAt
        });
        
        return res.json({
          success: true,
          message: 'Pago ya rechazado previamente',
          data: {
            purchaseId: purchase.purchaseId,
            status: mapPurchaseState('REJECTED'),
            rejectedAt: purchase.rejectedAt,
            idempotent: true
          }
        });
      }
      
      // Reject the payment using the model method
      await purchase.reject(admin._id, notes || 'Pago rechazado por el administrador');
      
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
        userId: purchase.userId.userId,
        reason: notes,
        transactionHash: purchase.txHash
      });
      
      res.json({
        success: true,
        message: 'Pago rechazado exitosamente',
        data: {
            purchaseId: purchase.purchaseId,
            status: mapPurchaseState('REJECTED'),
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

// Schema for individual purchase actions
const purchaseActionSchema = z.object({
  notes: z.string().optional()
});

/**
 * Approve a purchase (CONFIRMING -> APPROVED)
 */
router.patch('/purchases/:id/approve',
  captureOriginalState(Purchase, 'id'),
  auditMiddleware.paymentAction,
  async (req, res) => {
    try {
      const validatedData = purchaseActionSchema.parse(req.body);
      const { notes } = validatedData;
      const admin = req.user;
      
      // Find the purchase
      const purchase = await Purchase.findById(req.params.id)
        .populate('userId', '_id userId email firstName lastName')
        .populate('packageId', '_id packageId name price currency');
      
      if (!purchase) {
        return res.status(404).json({
          success: false,
          message: 'Compra no encontrada',
          code: 'PURCHASE_NOT_FOUND'
        });
      }
      
      // Check if purchase can be approved
      if (purchase.status !== 'CONFIRMING') {
        return res.status(400).json({
          success: false,
          message: `La compra está en estado ${purchase.status}, solo se pueden aprobar compras en estado CONFIRMING`,
          code: 'INVALID_PURCHASE_STATUS'
        });
      }
      
      // Check idempotency
      if (purchase.status === 'APPROVED') {
        return res.json({
          success: true,
          message: 'Compra ya aprobada previamente',
          data: {
            purchaseId: purchase.purchaseId,
            status: 'APPROVED',
            approvedAt: purchase.approvedAt,
            idempotent: true
          }
        });
      }
      
      // Approve the purchase
      await purchase.approve(admin._id, notes);
      
      logger.info('Purchase approved by admin', {
        adminId: admin.userId,
        purchaseId: purchase.purchaseId,
        userId: purchase.userId.userId,
        amount: purchase.totalAmount
      });
      
      res.json({
        success: true,
        message: 'Compra aprobada exitosamente',
        data: {
          purchaseId: purchase.purchaseId,
          status: 'APPROVED',
          approvedAt: purchase.approvedAt
        }
      });
      
    } catch (error) {
      logger.error('Approve purchase error:', {
        error: error.message,
        stack: error.stack,
        adminId: req.user?.userId,
        purchaseId: req.params.id,
        ip: req.ip
      });
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Datos de aprobación inválidos',
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
  }
);

/**
 * Reject a purchase (CONFIRMING -> REJECTED)
 */
router.patch('/purchases/:id/reject',
  captureOriginalState(Purchase, 'id'),
  auditMiddleware.paymentAction,
  async (req, res) => {
    try {
      const validatedData = purchaseActionSchema.parse(req.body);
      const { notes } = validatedData;
      const admin = req.user;
      
      // Find the purchase
      const purchase = await Purchase.findById(req.params.id)
        .populate('userId', '_id userId email firstName lastName')
        .populate('packageId', '_id packageId name price currency');
      
      if (!purchase) {
        return res.status(404).json({
          success: false,
          message: 'Compra no encontrada',
          code: 'PURCHASE_NOT_FOUND'
        });
      }
      
      // Check if purchase can be rejected
      if (purchase.status !== 'CONFIRMING') {
        return res.status(400).json({
          success: false,
          message: `La compra está en estado ${purchase.status}, solo se pueden rechazar compras en estado CONFIRMING`,
          code: 'INVALID_PURCHASE_STATUS'
        });
      }
      
      // Check idempotency
      if (purchase.status === 'REJECTED') {
        return res.json({
          success: true,
          message: 'Compra ya rechazada previamente',
          data: {
            purchaseId: purchase.purchaseId,
            status: 'REJECTED',
            rejectedAt: purchase.rejectedAt,
            idempotent: true
          }
        });
      }
      
      // Reject the purchase
      await purchase.reject(admin._id, notes || 'Compra rechazada por el administrador');
      
      // Release the assigned wallet
      if (purchase.assignedWallet) {
        const wallet = await Wallet.findById(purchase.assignedWallet);
        if (wallet) {
          await wallet.release();
        }
      }
      
      logger.info('Purchase rejected by admin', {
        adminId: admin.userId,
        purchaseId: purchase.purchaseId,
        userId: purchase.userId.userId,
        reason: notes
      });
      
      res.json({
        success: true,
        message: 'Compra rechazada exitosamente',
        data: {
          purchaseId: purchase.purchaseId,
          status: 'REJECTED',
          rejectedAt: purchase.rejectedAt
        }
      });
      
    } catch (error) {
      logger.error('Reject purchase error:', {
        error: error.message,
        stack: error.stack,
        adminId: req.user?.userId,
        purchaseId: req.params.id,
        ip: req.ip
      });
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Datos de rechazo inválidos',
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
  }
);

/**
 * Mark purchase as paid (APPROVED -> ACTIVE)
 */
router.patch('/purchases/:id/mark-paid',
  captureOriginalState(Purchase, 'id'),
  auditMiddleware.paymentAction,
  async (req, res) => {
    try {
      const validatedData = purchaseActionSchema.parse(req.body);
      const { notes } = validatedData;
      const admin = req.user;
      
      // Find the purchase
      const purchase = await Purchase.findById(req.params.id)
        .populate('userId', '_id userId email firstName lastName')
        .populate('packageId', '_id packageId name price currency');
      
      if (!purchase) {
        return res.status(404).json({
          success: false,
          message: 'Compra no encontrada',
          code: 'PURCHASE_NOT_FOUND'
        });
      }
      
      // Check if purchase can be marked as paid
      if (purchase.status !== 'APPROVED') {
        return res.status(400).json({
          success: false,
          message: `La compra está en estado ${purchase.status}, solo se pueden marcar como pagadas compras en estado APPROVED`,
          code: 'INVALID_PURCHASE_STATUS'
        });
      }
      
      // Check idempotency
      if (purchase.status === 'ACTIVE') {
        return res.json({
          success: true,
          message: 'Compra ya marcada como pagada previamente',
          data: {
            purchaseId: purchase.purchaseId,
            status: 'ACTIVE',
            activatedAt: purchase.activatedAt,
            idempotent: true
          }
        });
      }
      
      // Start transaction session for atomicity
      const session = await Purchase.startSession();
      
      try {
        await session.withTransaction(async () => {
          // Activate the purchase
          await purchase.activate();
          
          // Save with session
          await purchase.save({ session });
          
          // Create benefit transaction
          await Transaction.createBenefitTransaction(
            purchase.userId._id,
            0, // Initial benefit amount is 0
            purchase.currency,
            purchase._id,
            notes || 'Purchase marked as paid - benefits will start processing',
            session
          );
          
          // Create commissions for referral chain
          await createCommissions(purchase, session);
          
          // Update package statistics
          await Package.findByIdAndUpdate(
            purchase.packageId._id,
            {
              $inc: {
                purchaseCount: 1,
                totalRevenue: purchase.totalAmount
              }
            },
            { session }
          );
        });
      } finally {
        await session.endSession();
      }
      
      logger.info('Purchase marked as paid by admin', {
        adminId: admin.userId,
        purchaseId: purchase.purchaseId,
        userId: purchase.userId.userId,
        amount: purchase.totalAmount
      });
      
      res.json({
        success: true,
        message: 'Compra marcada como pagada y activada exitosamente',
        data: {
          purchaseId: purchase.purchaseId,
          status: mapPurchaseState('ACTIVE'),
          activatedAt: purchase.activatedAt
        }
      });
      
    } catch (error) {
      logger.error('Mark purchase as paid error:', {
        error: error.message,
        stack: error.stack,
        adminId: req.user?.userId,
        purchaseId: req.params.id,
        ip: req.ip
      });
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
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
  }
);

/**
 * Helper function to confirm purchase and create commissions
 */
async function confirmPurchase(purchase, admin, notes) {
  // Start transaction session for atomicity
  const session = await Purchase.startSession();
  
  try {
    await session.withTransaction(async () => {
      // Approve the purchase first
      await purchase.approve(admin._id, notes);
      
      // Then activate it
      await purchase.activate();
      
      // Save with session
      await purchase.save({ session });
      
      // Create benefit schedule for the activated purchase
      try {
        await BenefitSchedule.createFromPurchase(purchase);
        logger.info('Benefit schedule created for purchase', {
          purchaseId: purchase.purchaseId,
          userId: purchase.userId?.userId || purchase.userId
        });
      } catch (scheduleError) {
        logger.error('Failed to create benefit schedule', {
          purchaseId: purchase.purchaseId,
          error: scheduleError.message
        });
        // Don't fail the entire transaction for schedule creation errors
      }
      
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
  
  if (!user.referredBy) {
    logger.debug('User has no referrer, skipping commission creation', {
      userId: user.userId,
      purchaseId: purchase.purchaseId
    });
    return;
  }
  
  // Obtener referidor directo
  const directReferrer = await User.findById(user.referredBy).session(session);
  if (!directReferrer || !directReferrer.isActive) {
    logger.debug('Direct referrer not found or inactive', {
      userId: user.userId,
      referrerId: user.referredBy
    });
    return;
  }
  
  let parentReferrer = null;
  
  // 2. Verificar comisión padre (10%) - solo si el referidor directo tiene su primer referido
  const referrerPurchases = await Purchase.countDocuments({
    user: directReferrer._id,
    status: 'completed'
  }).session(session);
  
  if (referrerPurchases === 0 && directReferrer.referredBy) {
    const potentialParent = await User.findById(directReferrer.referredBy).session(session);
    
    if (potentialParent && potentialParent.isActive) {
      parentReferrer = potentialParent;
    }
  }
  
  // Crear schedules de comisiones usando BenefitSchedule
  const commissionSchedules = await BenefitSchedule.createCommissionSchedules(
    purchase,
    directReferrer._id,
    parentReferrer?._id
  );
  
  // Guardar todos los schedules de comisiones
  for (const schedule of commissionSchedules) {
    await schedule.save({ session });
  }
  
  logger.info('Commission schedules created for purchase', {
    purchaseId: purchase.purchaseId,
    userId: user.userId,
    schedulesCreated: commissionSchedules.length,
    types: commissionSchedules.map(s => s.type),
    referrer: directReferrer._id,
    parent: parentReferrer?._id
  });
}

/**
 * GET /api/admin/overview
 * Get admin overview with key KPIs and metrics
 */
router.get('/overview', adminOverviewCache(15), async (req, res) => {
  try {
    const MetricsService = require('../services/metricsService');
    
    // Usar el servicio centralizado de métricas
    const metrics = await MetricsService.getAllMetrics();

    res.json({
      success: true,
      data: metrics
    });

  } catch (error) {
    logger.error('Admin overview error:', {
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
 * GET /api/admin/dashboard/stats
 * Get admin dashboard statistics
 */
router.get('/dashboard/stats', adminOverviewCache(15), async (req, res) => {
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
            totalAmount: toApiNumber(stat.totalAmount || 0)
          };
          return acc;
        }, {}),
        totalRevenue: toApiNumber(purchaseStats.reduce((sum, stat) => sum + (stat.totalAmount || 0), 0))
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
            totalAmount: toApiNumber(stat.totalAmount || 0)
          };
          return acc;
        }, {}),
        totalAmount: toApiNumber(commissionStats.reduce((sum, stat) => sum + (stat.totalAmount || 0), 0))
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
    const { page = 1, limit = 20, search, status, role, isActive, isEmailVerified } = req.query;
    
    // Build filter
    const filter = {
      deletedAt: { $exists: false } // Exclude soft-deleted users
    };
    
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { userId: { $regex: search, $options: 'i' } },
        { referralCode: { $regex: search, $options: 'i' } },
        { telegramUsername: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Role filter
    if (role && ['user', 'admin', 'support'].includes(role)) {
      filter.role = role;
    }
    
    // Active status filter
    if (isActive !== undefined && isActive !== '') {
      filter.isActive = isActive === 'true';
    }
    
    // Email verification filter
    if (isEmailVerified !== undefined && isEmailVerified !== '') {
      filter.isEmailVerified = isEmailVerified === 'true';
    }
    
    // Legacy status filter (for backward compatibility)
    if (status) {
      if (status === 'active') filter.isActive = true;
      if (status === 'inactive') filter.isActive = false;
      if (status === 'verified') filter.isEmailVerified = true;
      if (status === 'unverified') filter.isEmailVerified = false;
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
          _id: user._id,
          userId: user.userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          country: user.country,
          role: user.role,
          referralCode: user.referralCode,
          isActive: user.isActive,
          isEmailVerified: user.isEmailVerified,
          telegramUsername: user.telegramUsername,
          telegramVerified: user.telegramVerified,
          balances: {
            available: toApiNumber(user.balances?.available || 0),
            pending: toApiNumber(user.balances?.pending || 0),
            total: toApiNumber(user.balances?.total || 0)
          },
          referralStats: {
            totalReferrals: user.referralStats?.totalReferrals || 0,
            activeReferrals: user.referralStats?.activeReferrals || 0,
            totalCommissions: toApiNumber(user.referralStats?.totalCommissions || 0)
          },
          referredBy: user.referredBy ? {
            userId: user.referredBy.userId,
            email: user.referredBy.email,
            fullName: `${user.referredBy.firstName} ${user.referredBy.lastName}`
          } : null,
          lastLogin: user.lastLoginAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
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

// User management schemas
const updateUserSchema = z.object({
  firstName: z.string().min(1, 'Nombre es requerido').max(50, 'Nombre muy largo').optional(),
  lastName: z.string().min(1, 'Apellido es requerido').max(50, 'Apellido muy largo').optional(),
  phone: z.string().min(10, 'Teléfono inválido').max(20, 'Teléfono muy largo').optional(),
  country: z.string().min(2, 'País es requerido').max(50, 'País muy largo').optional(),
  telegramUsername: z.string().optional(),
  isActive: z.boolean().optional(),
  isEmailVerified: z.boolean().optional(),
  role: z.enum(['user', 'admin', 'support']).optional(),
  notes: z.string().optional()
});

const userActionSchema = z.object({
  notes: z.string().optional()
});

/**
 * GET /api/admin/users/:id - Get user details
 */
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id)
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
    
    res.json({
      success: true,
      data: {
        _id: user._id,
        userId: user.userId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        country: user.country,
        role: user.role,
        referralCode: user.referralCode,
        isActive: user.isActive,
        isEmailVerified: user.isEmailVerified,
        telegramUsername: user.telegramUsername,
        balances: {
          available: toApiNumber(user.balances?.available || 0),
          pending: toApiNumber(user.balances?.pending || 0),
          total: toApiNumber(user.balances?.total || 0)
        },
        referralStats: {
          totalReferrals: user.referralStats?.totalReferrals || 0,
          activeReferrals: user.referralStats?.activeReferrals || 0,
          totalCommissions: toApiNumber(user.referralStats?.totalCommissions || 0)
        },
        referredBy: user.referredBy ? {
          userId: user.referredBy.userId,
          email: user.referredBy.email,
          fullName: `${user.referredBy.firstName} ${user.referredBy.lastName}`
        } : null,
        lastLogin: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
    
  } catch (error) {
    logger.error('Get user details error:', {
      error: error.message,
      userId: req.params.id,
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
 * PUT /api/admin/users/:id - Update user information
 */
router.put('/users/:id',
  captureOriginalState(User, 'id'),
  auditMiddleware.userChange('update'),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate request body
      const validation = updateUserSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Datos de usuario inválidos',
          errors: validation.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          })),
          code: 'VALIDATION_ERROR'
        });
      }
      
      const updateData = validation.data;
      
      // Find and update user
      const user = await User.findByIdAndUpdate(
        id,
        {
          ...updateData,
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
      
      logger.info('User updated by admin:', {
        userId: user.userId,
        adminId: req.user.userId,
        updatedFields: Object.keys(updateData),
        ip: req.ip
      });
      
      res.json({
        success: true,
        message: 'Usuario actualizado exitosamente',
        data: {
          _id: user._id,
          userId: user.userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          country: user.country,
          role: user.role,
          isActive: user.isActive,
          isEmailVerified: user.isEmailVerified,
          telegramUsername: user.telegramUsername,
          updatedAt: user.updatedAt
        }
      });
      
    } catch (error) {
      logger.error('Update user error:', {
        error: error.message,
        userId: req.params.id,
        adminId: req.user?.userId,
        ip: req.ip
      });
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * PATCH /api/admin/users/:id/activate - Activate user
 */
router.patch('/users/:id/activate',
  captureOriginalState(User, 'id'),
  auditMiddleware.userChange('activate'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const validation = userActionSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          code: 'VALIDATION_ERROR'
        });
      }
      
      const user = await User.findByIdAndUpdate(
        id,
        {
          isActive: true,
          updatedAt: new Date()
        },
        { new: true }
      ).select('userId email firstName lastName isActive');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado',
          code: 'USER_NOT_FOUND'
        });
      }
      
      logger.info('User activated by admin:', {
        userId: user.userId,
        adminId: req.user.userId,
        notes: validation.data.notes,
        ip: req.ip
      });
      
      res.json({
        success: true,
        message: 'Usuario activado exitosamente',
        data: {
          _id: user._id,
          userId: user.userId,
          isActive: user.isActive
        }
      });
      
    } catch (error) {
      logger.error('Activate user error:', {
        error: error.message,
        userId: req.params.id,
        adminId: req.user?.userId,
        ip: req.ip
      });
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * PATCH /api/admin/users/:id/deactivate - Deactivate user
 */
router.patch('/users/:id/deactivate',
  captureOriginalState(User, 'id'),
  auditMiddleware.userChange('deactivate'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const validation = userActionSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          code: 'VALIDATION_ERROR'
        });
      }
      
      const user = await User.findByIdAndUpdate(
        id,
        {
          isActive: false,
          updatedAt: new Date()
        },
        { new: true }
      ).select('userId email firstName lastName isActive');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado',
          code: 'USER_NOT_FOUND'
        });
      }
      
      logger.info('User deactivated by admin:', {
        userId: user.userId,
        adminId: req.user.userId,
        notes: validation.data.notes,
        ip: req.ip
      });
      
      res.json({
        success: true,
        message: 'Usuario desactivado exitosamente',
        data: {
          _id: user._id,
          userId: user.userId,
          isActive: user.isActive
        }
      });
      
    } catch (error) {
      logger.error('Deactivate user error:', {
        error: error.message,
        userId: req.params.id,
        adminId: req.user?.userId,
        ip: req.ip
      });
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * PATCH /api/admin/users/:id/manual-activate - Manually activate user with Telegram verification
 */
router.patch('/users/:id/manual-activate',
  captureOriginalState(User, 'id'),
  auditMiddleware.userChange('manual_activate'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const validation = userActionSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          code: 'VALIDATION_ERROR'
        });
      }
      
      const user = await User.findByIdAndUpdate(
        id,
        {
          isActive: true,
          telegramVerified: true,
          telegramVerifiedAt: new Date(),
          updatedAt: new Date()
        },
        { new: true }
      ).select('userId email firstName lastName isActive telegramVerified telegramVerifiedAt');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado',
          code: 'USER_NOT_FOUND'
        });
      }
      
      logger.info('User manually activated by admin:', {
        userId: user.userId,
        adminId: req.user.userId,
        notes: validation.data.notes,
        ip: req.ip
      });
      
      res.json({
        success: true,
        message: 'Usuario activado manualmente exitosamente',
        data: {
          _id: user._id,
          userId: user.userId,
          isActive: user.isActive,
          telegramVerified: user.telegramVerified,
          telegramVerifiedAt: user.telegramVerifiedAt
        }
      });
      
    } catch (error) {
      logger.error('Manual activate user error:', {
        error: error.message,
        userId: req.params.id,
        adminId: req.user?.userId,
        ip: req.ip
      });
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * DELETE /api/admin/users/:id - Delete user (soft delete)
 */
router.delete('/users/:id',
  captureOriginalState(User, 'id'),
  auditMiddleware.userChange('delete'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const validation = userActionSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          code: 'VALIDATION_ERROR'
        });
      }
      
      const user = await User.findById(id).select('userId email firstName lastName role isActive');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado',
          code: 'USER_NOT_FOUND'
        });
      }
      
      // Prevent deletion of admin users
      if (user.role === 'admin') {
        return res.status(403).json({
          success: false,
          message: 'No se pueden eliminar usuarios administradores',
          code: 'ADMIN_DELETE_FORBIDDEN'
        });
      }
      
      // Soft delete: deactivate user and mark as deleted
      await User.findByIdAndUpdate(id, {
        isActive: false,
        deletedAt: new Date(),
        deletedBy: req.user.userId,
        updatedAt: new Date()
      });
      
      logger.info('User deleted by admin:', {
        userId: user.userId,
        adminId: req.user.userId,
        notes: validation.data.notes,
        ip: req.ip
      });
      
      res.json({
        success: true,
        message: 'Usuario eliminado exitosamente'
      });
      
    } catch (error) {
      logger.error('Delete user error:', {
        error: error.message,
        userId: req.params.id,
        adminId: req.user?.userId,
        ip: req.ip
      });
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
   * GET /api/admin/health - System health status with traffic light logic
   */
  router.get('/health', async (req, res) => {
  try {
    const now = Date.now();
    
    // Check cache first
    if (healthCache.data && (now - healthCache.timestamp) < healthCache.ttl) {
      return res.status(healthCache.data.httpCode).json(healthCache.data.response);
    }
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    const ONE_DAY = 24 * 60 * 60 * 1000;
    
    // Get job states from database (O(1) operation)
    const jobStates = await JobState.getAllJobStates();
    
    // Check database connectivity
    let dbStatus = 'up';
    try {
      await mongoose.connection.db.admin().ping();
    } catch (dbError) {
      dbStatus = 'down';
      logger.error('Database ping failed:', dbError.message);
    }
    
    // Evaluate health status for each job
    function evaluateJobStatus(jobData) {
      if (!jobData?.lastRun) return 'down';
      const age = now - new Date(jobData.lastRun).getTime();
      if (age > ONE_DAY) return 'down';
      if (jobData.errors > 0 || age > TWO_HOURS) return 'degraded';
      return 'healthy';
    }
    
    const benefitsData = jobStates.benefits || {};
    const commissionsData = jobStates.commissions || {};
    
    const benefitsStatus = evaluateJobStatus(benefitsData);
    const commissionsStatus = evaluateJobStatus(commissionsData);
    
    // Get wallet pool statistics for Pool V2
    const walletStats = await Wallet.aggregate([
      { $match: { network: 'BEP20', currency: 'USDT', purpose: 'collection' } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    const walletCounts = {
      available: 0,
      disabled: 0
    };
    
    walletStats.forEach(stat => {
      if (walletCounts.hasOwnProperty(stat._id)) {
        walletCounts[stat._id] = stat.count;
      }
    });
    
    // Get rotation metrics for Pool V2
    const rotationMetrics = await Wallet.aggregate([
      { 
        $match: { 
          network: 'BEP20', 
          currency: 'USDT', 
          purpose: 'collection',
          status: 'available',
          lastShownAt: { $exists: true }
        } 
      },
      {
        $project: {
          shownCount: 1,
          lastShownAt: 1,
          timeSinceLastShown: {
            $divide: [
              { $subtract: [new Date(), '$lastShownAt'] },
              60000 // Convert to minutes
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          intervals: { $push: '$timeSinceLastShown' },
          shownCounts: { $push: '$shownCount' },
          maxShownCount: { $max: '$shownCount' },
          minShownCount: { $min: '$shownCount' },
          avgShownCount: { $avg: '$shownCount' },
          totalWallets: { $sum: 1 }
        }
      }
    ]);
    
    // Calculate rotation statistics
    let rotationStats = {
      medianDisplayIntervalMin: null,
      p90DisplayIntervalMin: null,
      skewShownCount90d: null
    };
    
    if (rotationMetrics.length > 0) {
      const metrics = rotationMetrics[0];
      const intervals = metrics.intervals.sort((a, b) => a - b);
      const shownCounts = metrics.shownCounts;
      
      // Calculate median interval
      if (intervals.length > 0) {
        const mid = Math.floor(intervals.length / 2);
        rotationStats.medianDisplayIntervalMin = intervals.length % 2 === 0
          ? DecimalCalc.round((intervals[mid - 1] + intervals[mid]) / 2, 1)
    : DecimalCalc.round(intervals[mid], 1);
      }
      
      // Calculate P90 interval
      if (intervals.length > 0) {
        const p90Index = Math.floor(intervals.length * 0.9);
        rotationStats.p90DisplayIntervalMin = DecimalCalc.round(intervals[p90Index], 1);
      }
      
      // Calculate skew (max/min ratio)
      if (metrics.minShownCount > 0) {
        rotationStats.skewShownCount90d = DecimalCalc.round(metrics.maxShownCount / metrics.minShownCount, 1);
      }
    }
    
    // Get last shown timestamp
    const lastShown = await Wallet.findOne(
      { network: 'BEP20', currency: 'USDT', lastShownAt: { $exists: true } },
      { lastShownAt: 1 },
      { sort: { lastShownAt: -1 } }
    );
    
    // Get today's benefits and referrals statistics
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    // Get today's benefits count and amount
    const benefitsToday = await BenefitLedger.aggregate([
      {
        $match: {
          type: 'DAILY_BENEFIT',
          paidAt: { $gte: todayStart, $lte: todayEnd },
          status: 'paid'
        }
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);
    
    // Get today's referral commissions count and amount
    const referralsToday = await Ledger.aggregate([
      {
        $match: {
          type: 'REFERRAL_DIRECT',
          transactionDate: { $gte: todayStart, $lte: todayEnd },
          status: 'confirmed'
        }
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);
    
    const benefitsTodayData = benefitsToday[0] || { count: 0, totalAmount: 0 };
    const referralsTodayData = referralsToday[0] || { count: 0, totalAmount: 0 };

    // Get authentication metrics - signups in last 24 hours and 7 days
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgoAuth = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const signups24h = await mongoose.connection.db.collection('users').countDocuments({
      createdAt: { $gte: yesterday }
    });
    
    const signups7d = await mongoose.connection.db.collection('users').countDocuments({
      createdAt: { $gte: sevenDaysAgoAuth }
    });

    // Get failed login attempts in last hour (from audit logs)
    let failedLogins1h = 0;
    try {
      const AuditLog = require('../models/AuditLog');
      failedLogins1h = await AuditLog.countDocuments({
        action: 'LOGIN_FAILED',
        timestamp: { $gte: oneHourAgo }
      });
    } catch (auditError) {
      logger.warn('Could not fetch failed login statistics:', auditError.message);
    }

    // Get referral attribution rate - users with referrer vs total signups in last 24 hours and 7 days
    const signupsWithReferrer24h = await mongoose.connection.db.collection('users').countDocuments({
      createdAt: { $gte: yesterday },
      referredBy: { $exists: true, $ne: null }
    });
    
    const signupsWithReferrer7d = await mongoose.connection.db.collection('users').countDocuments({
      createdAt: { $gte: sevenDaysAgoAuth },
      referredBy: { $exists: true, $ne: null }
    });

    const attributedRate24h = signups24h > 0 
      ? Math.round((signupsWithReferrer24h / signups24h) * 100 * 10) / 10
      : 0;
      
    const attributedRate7d = signups7d > 0 
      ? Math.round((signupsWithReferrer7d / signups7d) * 100 * 10) / 10
      : 0;
    
    // Get user import statistics
    let importStats = {
      runningJobs: 0,
      lastJob: null,
      rowsPerMinute: null
    };
    
    try {
      const UserImportJob = require('../models/UserImportJob');
      
      // Count running jobs
      importStats.runningJobs = await UserImportJob.countDocuments({
        status: { $in: ['queued', 'running'] }
      });
      
      // Get last completed job
      const lastJob = await UserImportJob.findOne(
        { status: { $in: ['completed', 'failed', 'partial'] } },
        { status: 1, startedAt: 1, finishedAt: 1, totalRows: 1, validRows: 1, invalidRows: 1, importedRows: 1 },
        { sort: { finishedAt: -1 } }
      );
      
      if (lastJob) {
        const duration = lastJob.finishedAt && lastJob.startedAt 
          ? (new Date(lastJob.finishedAt) - new Date(lastJob.startedAt)) / 1000 / 60 // minutes
          : null;
        
        importStats.lastJob = {
          status: lastJob.status,
          duration: duration ? Math.round(duration * 10) / 10 : null,
          valid: lastJob.validRows || 0,
          invalid: lastJob.invalidRows || 0,
          imported: lastJob.importedRows || 0,
          total: lastJob.totalRows || 0
        };
        
        // Calculate rows per minute
        if (duration && duration > 0 && lastJob.totalRows > 0) {
          importStats.rowsPerMinute = Math.round((lastJob.totalRows / duration) * 10) / 10;
        }
      }
    } catch (importError) {
      logger.warn('Could not fetch import statistics:', importError.message);
    }
    
    // Get feature flags summary by cohort
    let featureFlagsSummary = {
      totalUsers: 0,
      cohortsWithPackages: 0,
      cohortsWithWithdrawals: 0,
      usersInPackageEnabledCohorts: 0,
      usersInWithdrawalEnabledCohorts: 0
    };
    
    try {
      // Get total users count
      featureFlagsSummary.totalUsers = await mongoose.connection.db.collection('users').countDocuments({});
      
      // Get cohorts with feature flags enabled
      const cohortsWithFlags = await Cohort.find({
        $or: [
          { 'featureFlags.FEATURE_COHORT_PACKAGES': true },
          { 'featureFlags.FEATURE_COHORT_WITHDRAWALS': true }
        ]
      }, { name: 1, featureFlags: 1, userCount: 1 });
      
      cohortsWithFlags.forEach(cohort => {
        if (cohort.featureFlags?.FEATURE_COHORT_PACKAGES) {
          featureFlagsSummary.cohortsWithPackages++;
          featureFlagsSummary.usersInPackageEnabledCohorts += cohort.userCount || 0;
        }
        if (cohort.featureFlags?.FEATURE_COHORT_WITHDRAWALS) {
          featureFlagsSummary.cohortsWithWithdrawals++;
          featureFlagsSummary.usersInWithdrawalEnabledCohorts += cohort.userCount || 0;
        }
      });
      
    } catch (cohortError) {
      logger.warn('Could not fetch feature flags summary:', cohortError.message);
    }
    
    // Get withdrawal statistics
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const withdrawalStats = await mongoose.connection.db.collection('withdrawals').aggregate([
      {
        $facet: {
          pending: [
            { $match: { status: 'pending' } },
            { $count: 'count' }
          ],
          processing: [
            { $match: { status: 'processing' } },
            { $count: 'count' }
          ],
          completed24h: [
            { 
              $match: { 
                status: 'completed',
                createdAt: { $gte: oneDayAgo }
              }
            },
            { $count: 'count' }
          ],
          avgProcessing7d: [
            {
              $match: {
                status: 'completed',
                approvedAt: { $exists: true },
                completedAt: { $exists: true },
                createdAt: { $gte: sevenDaysAgo }
              }
            },
            {
              $project: {
                processingMinutes: {
                  $divide: [
                    { $subtract: ['$completedAt', '$approvedAt'] },
                    60000 // Convert milliseconds to minutes
                  ]
                }
              }
            },
            {
              $group: {
                _id: null,
                avgMinutes: { $avg: '$processingMinutes' }
              }
            }
          ],
          slaHitRate7d: [
            {
              $match: {
                status: 'completed',
                processingETA: { $exists: true },
                completedAt: { $exists: true },
                createdAt: { $gte: sevenDaysAgo }
              }
            },
            {
              $project: {
                hitSLA: {
                  $cond: {
                    if: { $lte: ['$completedAt', '$processingETA'] },
                    then: 1,
                    else: 0
                  }
                }
              }
            },
            {
              $group: {
                _id: null,
                totalWithETA: { $sum: 1 },
                slaHits: { $sum: '$hitSLA' }
              }
            },
            {
              $project: {
                hitRate: {
                  $cond: {
                    if: { $gt: ['$totalWithETA', 0] },
                    then: { $multiply: [{ $divide: ['$slaHits', '$totalWithETA'] }, 100] },
                    else: null
                  }
                }
              }
            }
          ]
        }
      }
    ]).toArray();
    
    const withdrawalCounts = {
      pending: withdrawalStats[0]?.pending[0]?.count || 0,
      processing: withdrawalStats[0]?.processing[0]?.count || 0,
      completed24h: withdrawalStats[0]?.completed24h[0]?.count || 0
    };
    
    // Calculate SLA metrics
    const avgProcessingMinutes7d = withdrawalStats[0]?.avgProcessing7d[0]?.avgMinutes || null;
    const slaHitRateData = withdrawalStats[0]?.slaHitRate7d[0];
    const slaHitRate7d = slaHitRateData?.hitRate || null;

    // Calculate reports metrics for last 24h
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Sales metrics
    const salesMetrics = await Purchase.aggregate([
      {
        $match: {
          createdAt: { $gte: last24h },
          status: 'ACTIVE'
        }
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Referrals commissions metrics
    const referralsMetrics = await Commission.aggregate([
      {
        $match: {
          createdAt: { $gte: last24h },
          status: 'released'
        }
      },
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$commissionAmount' }
        }
      }
    ]);

    // Benefits metrics
    const benefitsMetrics = await BenefitSchedule.aggregate([
      {
        $match: {
          'statusByDay.status': 'released',
          'statusByDay.releasedAt': { $gte: last24h }
        }
      },
      {
        $unwind: '$statusByDay'
      },
      {
        $match: {
          'statusByDay.status': 'released',
          'statusByDay.releasedAt': { $gte: last24h }
        }
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: '$dailyBenefitAmount' }
        }
      }
    ]);

    // Withdrawals metrics
    const withdrawalsMetrics = await Withdrawal.aggregate([
      {
        $facet: {
          requested: [
            {
              $match: {
                createdAt: { $gte: last24h }
              }
            },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                totalAmount: { $sum: '$amount' }
              }
            }
          ],
          completed: [
            {
              $match: {
                completedAt: { $gte: last24h },
                status: 'completed'
              }
            },
            {
              $group: {
                _id: null,
                count: { $sum: 1 }
              }
            }
          ]
        }
      }
    ]);

    // CSV exports metrics (simulated - would need audit log)
    const csvExportsLast24h = 0; // TODO: Implement audit log tracking
    const csvExportsLast7d = 0;  // TODO: Implement audit log tracking
    
    // Check if cron jobs are enabled
    const flagsOk = process.env.ENABLE_BENEFITS_RELEASE === 'true' && 
                    process.env.ENABLE_COMMISSIONS_RELEASE === 'true';
    
    // Determine overall system status
    let overallStatus = 'healthy';
    if (!flagsOk || dbStatus === 'down') {
      overallStatus = 'down';
    } else if (benefitsStatus === 'down' || commissionsStatus === 'down') {
      overallStatus = 'down';
    } else if (benefitsStatus === 'degraded' || commissionsStatus === 'degraded') {
      overallStatus = 'degraded';
    }
    
    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      benefits: {
        lastRun: benefitsData.lastRun || null,
        processed: benefitsData.processed || 0,
        errors: benefitsData.errors || 0,
        totalAmount: benefitsData.totalAmount || 0,
        status: benefitsData.status || 'unknown',
        errorMessage: benefitsData.errorMessage || null,
        healthStatus: benefitsStatus
      },
      commissionsUnlock: {
        lastRun: commissionsData.lastRun || null,
        processed: commissionsData.processed || 0,
        errors: commissionsData.errors || 0,
        totalAmount: commissionsData.totalAmount || 0,
        status: commissionsData.status || 'unknown',
        errorMessage: commissionsData.errorMessage || null,
        healthStatus: commissionsStatus
      },
      database: {
        status: dbStatus
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        timezone: process.env.TZ || 'UTC',
        version: require('../../package.json').version,
        commit: process.env.APP_COMMIT || 'unknown',
        uptimeSec: Math.round(process.uptime())
      },
      cronJobs: {
        benefitsEnabled: process.env.ENABLE_BENEFITS_RELEASE === 'true',
        commissionsEnabled: process.env.ENABLE_COMMISSIONS_RELEASE === 'true',
        schedules: {
          benefits: '0 3 * * *',
          commissions: '30 3 * * *'
        }
      },
      walletPool: {
        total: Object.values(walletCounts).reduce((sum, count) => sum + count, 0),
        available: walletCounts.available,
        disabled: walletCounts.disabled,
        rotation: rotationStats,
        lastShownAt: lastShown?.lastShownAt || null
      },
      withdrawals: {
        pending: withdrawalCounts.pending,
        processing: withdrawalCounts.processing,
        completed24h: withdrawalCounts.completed24h,
        avgProcessingMinutes7d: avgProcessingMinutes7d ? Math.round(avgProcessingMinutes7d * 10) / 10 : null,
        slaHitRate7d: slaHitRate7d ? `${Math.round(slaHitRate7d * 10) / 10}%` : null
      },
      benefitsToday: {
        count: benefitsTodayData.count,
        totalAmount: Math.round(benefitsTodayData.totalAmount * 100) / 100
      },
      referralsToday: {
        count: referralsTodayData.count,
        totalAmount: Math.round(referralsTodayData.totalAmount * 100) / 100
      },
      imports: {
        runningJobs: importStats.runningJobs,
        lastJob: importStats.lastJob,
        rowsPerMinute: importStats.rowsPerMinute
      },
      auth: {
        signups24h: signups24h,
        signups7d: signups7d,
        failedLogins1h: failedLogins1h
      },
      referrals: {
        attributedRate24h: `${attributedRate24h}%`,
        attributedRate7d: `${attributedRate7d}%`
      },
      reports: {
        salesLast24h: {
          count: salesMetrics[0]?.count || 0,
          totalAmount: Math.round((salesMetrics[0]?.totalAmount || 0) * 100) / 100,
          avgTicket: salesMetrics[0]?.count > 0 ? Math.round((salesMetrics[0].totalAmount / salesMetrics[0].count) * 100) / 100 : 0
        },
        referralsLast24h: {
          directCommissions: Math.round((referralsMetrics.find(r => r._id === 'direct')?.totalAmount || 0) * 100) / 100,
          parentGlobalCommissions: Math.round((referralsMetrics.find(r => r._id === 'GLOBAL_PARENT')?.totalAmount || 0) * 100) / 100,
          totalCommissions: Math.round((referralsMetrics.reduce((sum, r) => sum + (r.totalAmount || 0), 0)) * 100) / 100
        },
        benefitsLast24h: {
          released: benefitsMetrics[0]?.count || 0,
          totalAmount: Math.round((benefitsMetrics[0]?.totalAmount || 0) * 100) / 100,
          avgBenefit: benefitsMetrics[0]?.count > 0 ? Math.round((benefitsMetrics[0].totalAmount / benefitsMetrics[0].count) * 100) / 100 : 0
        },
        withdrawalsLast24h: {
          requested: withdrawalsMetrics[0]?.requested[0]?.count || 0,
          completed: withdrawalsMetrics[0]?.completed[0]?.count || 0,
          totalAmount: Math.round((withdrawalsMetrics[0]?.requested[0]?.totalAmount || 0) * 100) / 100
        },
        csvExports: {
          last24h: csvExportsLast24h,
          last7d: csvExportsLast7d,
          mostRequested: 'sales'
        },
        parentGlobalQueue: {
          title: 'Padre global (cola D+18)',
          pendingCount: referralsMetrics.find(r => r._id === 'GLOBAL_PARENT')?.count || 0,
          pendingAmount: Math.round((referralsMetrics.find(r => r._id === 'GLOBAL_PARENT')?.totalAmount || 0) * 100) / 100,
          status: 'pending_release',
          releaseDate: 'D+18'
        }
      },
      featureFlags: featureFlagsSummary
    };
    
    // Return HTTP 503 for 'down' status to integrate with monitors
    const httpCode = overallStatus === 'down' ? 503 : 200;
    
    // Cache the response
    healthCache = {
      data: { response, httpCode },
      timestamp: now,
      ttl: 10000
    };
    
    res.status(httpCode).json(response);
    
  } catch (error) {
    logger.error('Admin health check error:', {
      error: error.message,
      stack: error.stack,
      adminId: req.user?.userId,
      ip: req.ip
    });

    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Error interno del servidor',
      code: 'HEALTH_CHECK_ERROR'
    });
  }
});

/**
 * GET /api/admin/referrals
 * Get all referrals data for admin dashboard
 */
router.get('/referrals', ReferralController.getAdminReferrals);

/**
 * GET /api/admin/referrals/stats
 * Get referral statistics for admin dashboard
 */
router.get('/referrals/stats', ReferralController.getAdminReferralStats);

// Package management schemas
const createPackageSchema = z.object({
  name: z.string().min(1, 'Nombre del paquete es requerido'),
  price: z.number().min(0, 'Precio debe ser mayor o igual a 0'),
  currency: z.string().default('USDT'),
  description: z.string().min(1, 'Descripción es requerida'),
  withdrawalSlaTargetMinutes: z.number().min(1, 'SLA de retiro es requerido'),
  icon: z.string().default('💎'),
  popular: z.boolean().default(false),
  isActive: z.boolean().default(true),
  isVisible: z.boolean().default(true),
  features: z.array(z.string()).default([])
});

const updatePackageSchema = z.object({
  name: z.string().optional(),
  price: z.number().min(0).optional(),
  currency: z.string().optional(),
  description: z.string().optional(),
  withdrawalSlaTargetMinutes: z.number().min(1).optional(),
  icon: z.string().optional(),
  popular: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  features: z.array(z.string()).optional()
});

const injectPackageSchema = z.object({
  userId: z.string().min(1, 'ID de usuario es requerido'),
  packageId: z.string().min(1, 'ID de paquete es requerido'),
  notes: z.string().optional()
});

// Package management routes

/**
 * GET /api/admin/packages
 * Get all packages for admin management
 */
router.get('/packages', async (req, res) => {
  try {
    const { page = 1, limit = 50, search, status } = req.query;
    
    // Build filter
    const filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      if (status === 'active') filter.isActive = true;
      if (status === 'inactive') filter.isActive = false;
      if (status === 'visible') filter.isVisible = true;
      if (status === 'hidden') filter.isVisible = false;
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get packages
    const packages = await Package.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count
    const totalCount = await Package.countDocuments(filter);
    
    res.json({
      success: true,
      packages: packages.map(pkg => ({
        ...pkg.toObject(),
        price: toApiNumber(pkg.price)
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNext: skip + packages.length < totalCount,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    logger.error('Error fetching admin packages:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/admin/packages
 * Create a new package
 */
router.post('/packages', auditMiddleware.packageAction('create'), async (req, res) => {
  try {
    const validatedData = createPackageSchema.parse(req.body);
    
    // Check if package name already exists
    const existingPackage = await Package.findOne({ name: validatedData.name });
    if (existingPackage) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un paquete con ese nombre'
      });
    }
    
    // Generate packageId
    const packageCount = await Package.countDocuments();
    const packageId = `PKG${String(packageCount + 1).padStart(3, '0')}`;
    
    // Create package
    const packageData = {
      ...validatedData,
      packageId,
      totalSold: 0,
      totalRevenue: 0
    };
    
    const newPackage = new Package(packageData);
    await newPackage.save();
    
    logger.info(`Package created: ${newPackage.packageId} by admin ${req.user.userId}`);
    
    res.status(201).json({
      success: true,
      message: 'Paquete creado exitosamente',
      package: newPackage
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: error.errors
      });
    }
    
    logger.error('Error creating package:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * PUT /api/admin/packages/:id
 * Update an existing package
 */
router.put('/packages/:id', auditMiddleware.packageAction('update'), captureOriginalState(Package), async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updatePackageSchema.parse(req.body);
    
    // Find package
    const package = await Package.findById(id);
    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Paquete no encontrado'
      });
    }
    
    // Check if name is being changed and already exists
    if (validatedData.name && validatedData.name !== package.name) {
      const existingPackage = await Package.findOne({ name: validatedData.name, _id: { $ne: id } });
      if (existingPackage) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un paquete con ese nombre'
        });
      }
    }
    
    // Update package
    Object.assign(package, validatedData);
    package.updatedAt = new Date();
    await package.save();
    
    logger.info(`Package updated: ${package.packageId} by admin ${req.user.userId}`);
    
    res.json({
      success: true,
      message: 'Paquete actualizado exitosamente',
      package
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: error.errors
      });
    }
    
    logger.error('Error updating package:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * DELETE /api/admin/packages/:id
 * Delete a package (soft delete by setting isActive to false)
 */
router.delete('/packages/:id', auditMiddleware.packageAction('delete'), captureOriginalState(Package), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find package
    const package = await Package.findById(id);
    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Paquete no encontrado'
      });
    }
    
    // Check if package has active purchases
    const activePurchases = await Purchase.countDocuments({
      package: id,
      status: { $in: ['PENDING_PAYMENT', 'CONFIRMING', 'APPROVED', 'ACTIVE'] }
    });
    
    if (activePurchases > 0) {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar un paquete con compras activas'
      });
    }
    
    // Soft delete by setting isActive to false
    package.isActive = false;
    package.isVisible = false;
    package.updatedAt = new Date();
    await package.save();
    
    logger.info(`Package deleted: ${package.packageId} by admin ${req.user.userId}`);
    
    res.json({
      success: true,
      message: 'Paquete eliminado exitosamente'
    });
  } catch (error) {
    logger.error('Error deleting package:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/admin/inject-package
 * Inject a package directly to a user (admin only)
 */
router.post('/inject-package', auditMiddleware.packageAction('inject'), async (req, res) => {
  try {
    const validatedData = injectPackageSchema.parse(req.body);
    const { userId, packageId, notes } = validatedData;
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // Find package
    const package = await Package.findById(packageId);
    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Paquete no encontrado'
      });
    }
    
    // Generate purchase ID
    const purchaseCount = await Purchase.countDocuments();
    const purchaseId = `PUR${String(purchaseCount + 1).padStart(6, '0')}`;
    
    // Create purchase record
    const purchase = new Purchase({
      purchaseId,
      user: user._id,
      package: package._id,
      amount: package.price,
      currency: package.currency,
      status: 'confirmed',
      paymentMethod: 'admin_injection',
      confirmedAt: new Date(),
      confirmedBy: req.user._id,
      adminNotes: notes || `Paquete inyectado por admin ${req.user.userId}`,
      transactionHash: `ADMIN_INJECT_${Date.now()}`,
      isAdminInjection: true
    });
    
    await purchase.save();
    
    // Update package statistics
    package.totalSold += 1;
    package.totalRevenue += package.price;
    await package.save();
    
    // Update user balance (add package value to balance)
    user.balance = (user.balance || 0) + package.price;
    await user.save();
    
    logger.info(`Package injected: ${package.name} to user ${user.userId} by admin ${req.user.userId}`);
    
    res.json({
      success: true,
      message: `Paquete ${package.name} inyectado exitosamente a ${user.firstName} ${user.lastName}`,
      purchase: {
        purchaseId: purchase.purchaseId,
        package: package.name,
        user: `${user.firstName} ${user.lastName}`,
        amount: package.price,
        currency: package.currency
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: error.errors
      });
    }
    
    logger.error('Error injecting package:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Wallet management schemas
const createWalletSchema = z.object({
  address: z.string().min(1, 'Dirección de wallet es requerida'),
  network: z.string().default('BEP20'),
  currency: z.string().default('USDT'),
  label: z.string().optional(),
  notes: z.string().optional()
});

const updateWalletSchema = z.object({
  label: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
  status: z.enum(['AVAILABLE', 'DISABLED']).optional()
});

/**
 * GET /api/admin/wallets
 * Get paginated list of wallets with stats
 */
router.get('/wallets', enforceUSDTBEP20Query, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, network = 'BEP20' } = req.query;
    
    // Build filter
    const filter = { network };
    
    if (search) {
      filter.$or = [
        { address: { $regex: search, $options: 'i' } },
        { label: { $regex: search, $options: 'i' } },
        { walletId: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get wallets with pagination
    const wallets = await Wallet.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    // Get total count
    const totalCount = await Wallet.countDocuments(filter);
    
    // Transform wallets for response
    const transformedWallets = wallets.map(wallet => ({
      id: wallet._id,
      walletId: wallet.walletId,
      address: wallet.address,
      network: wallet.network,
      currency: wallet.currency,
      status: wallet.status,
      isActive: wallet.isActive,
      label: wallet.label,
      notes: wallet.notes,
      lastUsed: wallet.lastUsed,
      totalReceived: wallet.totalReceived || 0,
      totalAssigned: wallet.totalAssigned || 0,
      successfulTransactions: wallet.successfulTransactions || 0,
      failedTransactions: wallet.failedTransactions || 0,
      shownCount: wallet.shownCount || 0,
      lastShownAt: wallet.lastShownAt,
      createdAt: wallet.createdAt
    }));
    
    res.json({
      success: true,
      data: transformedWallets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });
    
  } catch (error) {
    logger.error('Error fetching wallets:', {
      error: error.message,
      adminId: req.user?.userId,
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'FETCH_WALLETS_ERROR'
    });
  }
});

/**
 * POST /api/admin/wallets
 * Create a new wallet
 */
router.post('/wallets', validateWalletAddress, auditMiddleware.walletAction('create'), async (req, res) => {
  try {
    const validatedData = createWalletSchema.parse(req.body);
    
    // Check if wallet address already exists
    const existingWallet = await Wallet.findOne({ 
      address: validatedData.address.toLowerCase() 
    });
    
    if (existingWallet) {
      return res.status(400).json({
        success: false,
        error: 'Ya existe una wallet con esta dirección',
        code: 'WALLET_ADDRESS_EXISTS'
      });
    }
    
    // Create new wallet
    const wallet = new Wallet({
      ...validatedData,
      address: validatedData.address.toLowerCase(),
      purpose: 'collection',
      status: 'AVAILABLE',
      isActive: true,
      totalReceived: 0,
      totalAssigned: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      shownCount: 0
    });
    
    await wallet.save();
    
    logger.info('Wallet created successfully', {
      walletId: wallet.walletId,
      address: wallet.address,
      adminId: req.user?.userId,
      ip: req.ip
    });
    
    res.status(201).json({
      success: true,
      data: {
        id: wallet._id,
        walletId: wallet.walletId,
        address: wallet.address,
        network: wallet.network,
        currency: wallet.currency,
        status: wallet.status,
        isActive: wallet.isActive,
        label: wallet.label,
        notes: wallet.notes
      },
      message: 'Wallet creada exitosamente'
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Datos de entrada inválidos',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }
    
    logger.error('Error creating wallet:', {
      error: error.message,
      adminId: req.user?.userId,
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'CREATE_WALLET_ERROR'
    });
  }
});

/**
 * PUT /api/admin/wallets/:id
 * Update wallet information
 */
router.put('/wallets/:id', validateWalletAddress, auditMiddleware.walletAction('update'), captureOriginalState(Wallet), async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateWalletSchema.parse(req.body);
    
    const wallet = await Wallet.findById(id);
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet no encontrada',
        code: 'WALLET_NOT_FOUND'
      });
    }
    
    // Update wallet fields
    Object.keys(validatedData).forEach(key => {
      if (validatedData[key] !== undefined) {
        wallet[key] = validatedData[key];
      }
    });
    
    await wallet.save();
    
    logger.info('Wallet updated successfully', {
      walletId: wallet.walletId,
      address: wallet.address,
      changes: validatedData,
      adminId: req.user?.userId,
      ip: req.ip
    });
    
    res.json({
      success: true,
      data: {
        id: wallet._id,
        walletId: wallet.walletId,
        address: wallet.address,
        network: wallet.network,
        currency: wallet.currency,
        status: wallet.status,
        isActive: wallet.isActive,
        label: wallet.label,
        notes: wallet.notes,
        lastUsed: wallet.lastUsed,
        totalReceived: wallet.totalReceived
      },
      message: 'Wallet actualizada exitosamente'
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Datos de entrada inválidos',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }
    
    logger.error('Error updating wallet:', {
      error: error.message,
      walletId: req.params.id,
      adminId: req.user?.userId,
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'UPDATE_WALLET_ERROR'
    });
  }
});

/**
 * DELETE /api/admin/wallets/:id
 * Delete a wallet (soft delete by setting isActive to false)
 */
router.delete('/wallets/:id', auditMiddleware.walletAction('delete'), captureOriginalState(Wallet), async (req, res) => {
  try {
    const { id } = req.params;
    
    const wallet = await Wallet.findById(id);
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet no encontrada',
        code: 'WALLET_NOT_FOUND'
      });
    }
    
    // Check if wallet is currently assigned
    if (wallet.status === 'assigned') {
      return res.status(400).json({
        success: false,
        error: 'No se puede eliminar una wallet que está actualmente asignada',
        code: 'WALLET_CURRENTLY_ASSIGNED'
      });
    }
    
    // Soft delete by setting isActive to false and status to disabled
    wallet.isActive = false;
    wallet.status = 'disabled';
    await wallet.save();
    
    logger.info('Wallet deleted successfully', {
      walletId: wallet.walletId,
      address: wallet.address,
      adminId: req.user?.userId,
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: 'Wallet eliminada exitosamente'
    });
    
  } catch (error) {
    logger.error('Error deleting wallet:', {
      error: error.message,
      walletId: req.params.id,
      adminId: req.user?.userId,
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'DELETE_WALLET_ERROR'
    });
  }
});

/**
 * POST /api/admin/wallets/:id/suspend
 * Suspend a wallet (set status to disabled)
 */
router.post('/wallets/:id/suspend', auditMiddleware.walletAction('suspend'), captureOriginalState(Wallet), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const wallet = await Wallet.findById(id);
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet no encontrada',
        code: 'WALLET_NOT_FOUND'
      });
    }
    
    // Suspend wallet
    wallet.status = 'DISABLED';
    if (reason) {
      wallet.notes = (wallet.notes ? wallet.notes + '\n' : '') + `Suspendida: ${reason}`;
    }
    await wallet.save();
    
    logger.info('Wallet suspended successfully', {
      walletId: wallet.walletId,
      address: wallet.address,
      reason,
      adminId: req.user?.userId,
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: 'Wallet suspendida exitosamente'
    });
    
  } catch (error) {
    logger.error('Error suspending wallet:', {
      error: error.message,
      walletId: req.params.id,
      adminId: req.user?.userId,
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'SUSPEND_WALLET_ERROR'
    });
  }
});

/**
 * POST /api/admin/wallets/:id/activate
 * Activate a suspended wallet
 */
router.post('/wallets/:id/activate', auditMiddleware.walletAction('activate'), captureOriginalState(Wallet), async (req, res) => {
  try {
    const { id } = req.params;
    
    const wallet = await Wallet.findById(id);
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet no encontrada',
        code: 'WALLET_NOT_FOUND'
      });
    }
    
    // Activate wallet
    wallet.status = 'AVAILABLE';
    wallet.isActive = true;
    await wallet.save();
    
    logger.info('Wallet activated successfully', {
      walletId: wallet.walletId,
      address: wallet.address,
      adminId: req.user?.userId,
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: 'Wallet activada exitosamente'
    });
    
  } catch (error) {
    logger.error('Error activating wallet:', {
      error: error.message,
      walletId: req.params.id,
      adminId: req.user?.userId,
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'ACTIVATE_WALLET_ERROR'
    });
  }
});

/**
 * GET /api/admin/wallets/:id/transactions
 * Get transaction history for a specific wallet
 */
router.get('/wallets/:id/transactions', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const wallet = await Wallet.findById(id);
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet no encontrada',
        code: 'WALLET_NOT_FOUND'
      });
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get transactions for this wallet
    const transactions = await Transaction.find({
      walletAddress: wallet.address
    })
    .populate('purchase', 'purchaseId totalAmount status')
    .populate('userId', 'userId email firstName lastName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();
    
    // Get total count
    const totalCount = await Transaction.countDocuments({
      walletAddress: wallet.address
    });
    
    // Transform transactions for response
    const transformedTransactions = transactions.map(tx => ({
      id: tx._id,
      transactionHash: tx.transactionHash,
      amount: toApiNumber(tx.amount),
      currency: tx.currency,
      status: tx.status,
      purchase: tx.purchase ? {
        purchaseId: tx.purchase.purchaseId,
        totalAmount: toApiNumber(tx.purchase.totalAmount),
        status: tx.purchase.status
      } : null,
      user: tx.userId ? {
        userId: tx.userId.userId,
        email: tx.userId.email,
        fullName: `${tx.userId.firstName} ${tx.userId.lastName}`
      } : null,
      createdAt: tx.createdAt,
      confirmedAt: tx.confirmedAt
    }));
    
    res.json({
      success: true,
      data: transformedTransactions,
      wallet: {
        id: wallet._id,
        address: wallet.address,
        network: wallet.network,
        currency: wallet.currency
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });
    
  } catch (error) {
    logger.error('Error fetching wallet transactions:', {
      error: error.message,
      walletId: req.params.id,
      adminId: req.user?.userId,
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'FETCH_TRANSACTIONS_ERROR'
    });
  }
});

// ===== LICENSES ROUTES =====
// Get all licenses with pagination and filtering
router.get('/licenses', authenticateToken, requireAdmin, licensesController.getLicenses);

// Get single license details
router.get('/licenses/:id', authenticateToken, requireAdmin, licensesController.getLicense);

// Pause a license
router.post('/licenses/:id/pause', authenticateToken, requireAdmin, licensesController.pauseLicense);

// Resume a license
router.post('/licenses/:id/resume', authenticateToken, requireAdmin, licensesController.resumeLicense);

// Complete a license
router.post('/licenses/:id/complete', authenticateToken, requireAdmin, licensesController.completeLicense);

// Update license cap percentage
router.patch('/licenses/:id/cap', authenticateToken, requireAdmin, licensesController.updateLicenseCap);

// ===== ALERT MANAGEMENT ROUTES =====
const AlertService = require('../services/AlertService');

// Get recent alerts with pagination
router.get('/alerts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const alerts = await AlertService.getRecentAlerts(parseInt(limit));
    
    // Apply offset if needed
    const paginatedAlerts = alerts.slice(parseInt(offset));
    
    res.json({
      success: true,
      data: {
        alerts: paginatedAlerts,
        total: alerts.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
    
  } catch (error) {
    logger.error('Error fetching alerts:', {
      error: error.message,
      adminId: req.user?.userId,
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'FETCH_ALERTS_ERROR'
    });
  }
});

// Acknowledge an alert
router.post('/alerts/:alertId/acknowledge', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { alertId } = req.params;
    const adminUserId = req.user.userId;
    
    const alert = await AlertService.acknowledgeAlert(alertId, adminUserId);
    
    res.json({
      success: true,
      data: alert,
      message: 'Alerta reconocida exitosamente'
    });
    
  } catch (error) {
    logger.error('Error acknowledging alert:', {
      error: error.message,
      alertId: req.params.alertId,
      adminId: req.user?.userId,
      ip: req.ip
    });
    
    if (error.message === 'Alert not found') {
      return res.status(404).json({
        success: false,
        error: 'Alerta no encontrada',
        code: 'ALERT_NOT_FOUND'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'ACKNOWLEDGE_ALERT_ERROR'
    });
  }
});

// Create a test alert (for testing purposes)
router.post('/alerts/test', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { type, priority, title, message, metadata } = req.body;
    
    // Validate required fields
    if (!type || !priority || !title || !message) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos: type, priority, title, message',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }
    
    // Validate type and priority
    if (!Object.values(AlertService.ALERT_TYPES).includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de alerta inválido',
        code: 'INVALID_ALERT_TYPE'
      });
    }
    
    if (!Object.values(AlertService.ALERT_PRIORITIES).includes(priority)) {
      return res.status(400).json({
        success: false,
        error: 'Prioridad de alerta inválida',
        code: 'INVALID_ALERT_PRIORITY'
      });
    }
    
    const alert = await AlertService.createAlert(
      type,
      priority,
      `[TEST] ${title}`,
      `[TEST] ${message}`,
      { ...metadata, testAlert: true, createdBy: req.user.userId }
    );
    
    res.json({
      success: true,
      data: alert,
      message: 'Alerta de prueba creada exitosamente'
    });
    
  } catch (error) {
    logger.error('Error creating test alert:', {
      error: error.message,
      adminId: req.user?.userId,
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'CREATE_TEST_ALERT_ERROR'
    });
  }
});

// Get alert statistics
router.get('/alerts/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const alerts = await AlertService.getRecentAlerts(100);
    
    const stats = {
      total: alerts.length,
      acknowledged: alerts.filter(a => a.acknowledged).length,
      unacknowledged: alerts.filter(a => !a.acknowledged).length,
      byType: {},
      byPriority: {},
      last24Hours: 0
    };
    
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    alerts.forEach(alert => {
      // Count by type
      stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
      
      // Count by priority
      stats.byPriority[alert.priority] = (stats.byPriority[alert.priority] || 0) + 1;
      
      // Count last 24 hours
      if (new Date(alert.timestamp) > last24Hours) {
        stats.last24Hours++;
      }
    });
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    logger.error('Error fetching alert stats:', {
      error: error.message,
      adminId: req.user?.userId,
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'FETCH_ALERT_STATS_ERROR'
    });
  }
});

module.exports = router;