/**
 * Payments Routes
 * Handles payment submissions, confirmations, and wallet assignments
 */

const express = require('express');
const { z } = require('zod');
const { Package, Wallet, Purchase, User, Commission, Transaction } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { paymentLimiter } = require('../middleware/rateLimiter');
const { validatePaymentRequest, enforceUSDTBEP20Query } = require('../middleware/usdtBep20Hardening');
const { DecimalCalc } = require('../utils/decimal');
const logger = require('../config/logger');
const PurchaseDTO = require('../dto/PurchaseDTO');
const { stateMapperMiddleware } = require('../utils/stateMapper');

const router = express.Router();

// Validation schemas
const submitPaymentSchema = z.object({
  packageId: z.string().min(1, 'Package ID es requerido'),
  quantity: z.number().int().min(1, 'Cantidad debe ser al menos 1').max(10, 'Cantidad máxima es 10')
});

const destinationSchema = z.object({
  purchaseId: z.string().min(1, 'Purchase ID es requerido').optional()
});

const confirmHashSchema = z.object({
  purchaseId: z.string().min(1, 'Purchase ID es requerido'),
  transactionHash: z.string().min(1, 'Hash de transacción es requerido')
});

/**
 * POST /api/payments/destination
 * Pool V2: Get payment destination wallet using LRS (no reservation)
 */
router.post('/destination', paymentLimiter, authenticateToken, enforceUSDTBEP20Query, async (req, res) => {
  try {
    const validatedData = destinationSchema.parse(req.body);
    const { purchaseId } = validatedData;
    
    const user = req.user;
    
    // If purchaseId provided, check if it exists and belongs to user
    let purchase = null;
    if (purchaseId) {
      purchase = await Purchase.findOne({
        purchaseId,
        user: user._id,
        status: { $in: ['PENDING_PAYMENT', 'CONFIRMING'] }
      });
      
      if (!purchase) {
        return res.status(404).json({
          success: false,
          message: 'Compra no encontrada o no válida',
          code: 'PURCHASE_NOT_FOUND'
        });
      }
      
      // If purchase already has a displayWalletId, return it for consistency
      if (purchase.displayWalletId) {
        const existingWallet = await Wallet.findById(purchase.displayWalletId);
        if (existingWallet && existingWallet.isAvailable) {
          return res.json({
            success: true,
            message: 'Dirección de pago obtenida',
            data: {
              address: existingWallet.address,
              network: existingWallet.network,
              currency: existingWallet.currency,
              amount: purchase.totalAmount,
              purchaseId: purchase.purchaseId,
              expiresAt: purchase.paymentDeadline
            }
          });
        }
      }
    }
    
    // Get wallet using LRS (Least Recently Shown)
    const wallet = await Wallet.getNextWalletLRS();
    
    if (!wallet) {
      logger.error('No available wallets in pool for destination', {
        userId: user.userId,
        purchaseId,
        ip: req.ip
      });
      
      return res.status(409).json({
        success: false,
        message: 'No hay wallets disponibles en este momento. Intenta más tarde.',
        code: 'NO_WALLET_AVAILABLE'
      });
    }
    
    // If purchase provided, update displayWalletId for UI consistency
    if (purchase) {
      purchase.displayWalletId = wallet._id;
      purchase.paymentAddress = wallet.address;
      await purchase.save();
    }
    
    logger.info('Payment destination provided', {
      userId: user.userId,
      purchaseId: purchase?.purchaseId,
      walletAddress: wallet.address,
      shownCount: wallet.shownCount,
      lastShownAt: wallet.lastShownAt
    });
    
    res.json({
      success: true,
      message: 'Dirección de pago obtenida',
      data: {
        address: wallet.address,
        network: wallet.network,
        currency: wallet.currency,
        amount: purchase?.totalAmount,
        purchaseId: purchase?.purchaseId,
        expiresAt: purchase?.paymentDeadline,
        instructions: {
          steps: [
            `Envía exactamente ${purchase?.totalAmount || 'el monto'} ${wallet.currency} a la dirección proporcionada`,
            `Usa la red ${wallet.network}`,
            'Copia el hash de la transacción una vez confirmada',
            'Proporciona el hash para confirmar tu pago'
          ],
          important: [
            'Asegúrate de usar la red correcta',
            'Envía el monto exacto',
            'Guarda el hash de la transacción',
            'No envíes desde exchanges, usa una wallet personal'
          ]
        }
      }
    });
    
  } catch (error) {
    logger.error('Get payment destination error:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.userId,
      body: req.body,
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
});

/**
 * POST /api/payments/submit
 * Legacy alias for /api/me/purchases - Submit a payment request
 */
router.post('/submit', paymentLimiter, authenticateToken, validatePaymentRequest, async (req, res) => {
  try {
    // Transform legacy request to new format
    const { packageId, quantity } = req.body;
    const package = await Package.findOne({ packageId, isActive: true });
    
    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Paquete no encontrado o no disponible',
        code: 'PACKAGE_NOT_FOUND'
      });
    }
    
    // Calculate amount based on package price and quantity
    const amountUSDT = package.price * (quantity || 1);
    
    // Forward to new endpoint logic
    const user = req.user;
    
    // Get available wallet from pool
    const wallet = await Wallet.findOne({ 
      isActive: true, 
      isAssigned: false 
    }).sort({ lastUsed: 1 });
    
    if (!wallet) {
      return res.status(503).json({ 
        success: false,
        message: 'No hay wallets disponibles en este momento',
        code: 'NO_WALLETS_AVAILABLE'
      });
    }

    // Create purchase
    const purchase = await Purchase.create({
      userId: user.userId,
      packageId,
      amountUSDT,
      payTo: wallet.address,
      network: 'BEP20',
      status: 'PENDING_PAYMENT',
      expiresAt: new Date(Date.now() + DecimalCalc.multiply(30, DecimalCalc.multiply(60, 1000))) // 30 minutes
    });

    // Mark wallet as temporarily assigned
    wallet.isAssigned = true;
    wallet.lastUsed = new Date();
    await wallet.save();

    res.status(201).json({
      success: true,
      data: {
        purchaseId: purchase.purchaseId,
        payTo: purchase.payTo,
        network: purchase.network,
        amountUSDT: purchase.amountUSDT,
        expiresAt: purchase.expiresAt
      }
    });

  } catch (error) {
    logger.error('Legacy submit payment error:', {
      error: error.message,
      userId: req.user?.userId,
      body: req.body,
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
 * POST /api/payments/confirm-hash
 * Legacy alias for /api/me/purchases/:id/confirm
 */
router.post('/confirm-hash', paymentLimiter, authenticateToken, async (req, res) => {
  try {
    const { purchaseId, transactionHash } = confirmHashSchema.parse(req.body);
    const user = req.user;
    
    // Find purchase to get the MongoDB _id
    const purchase = await Purchase.findOne({
      purchaseId: purchaseId,
      user: user._id
    });
    
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Compra no encontrada',
        code: 'PURCHASE_NOT_FOUND'
      });
    }
    
    // Transform legacy request to new format and forward to new route
    const newReq = {
      ...req,
      params: { id: purchase._id.toString() },
      body: { txHash: transactionHash }
    };
    
    // Import the user routes to access the confirm purchase handler
    const userRoutes = require('./user');
    
    // Find the confirm purchase route handler
    const confirmHandler = userRoutes.stack.find(layer => 
      layer.route && 
      layer.route.path === '/:id/confirm' && 
      layer.route.methods.post
    )?.route.stack[0].handle;
    
    if (confirmHandler) {
      // Call the new handler with transformed request
      await confirmHandler(newReq, res);
    } else {
      // Fallback if handler not found
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
    
  } catch (error) {
    logger.error('Confirm hash legacy route error:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.userId,
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
 * GET /api/payments/my-purchases
 * Get user's purchase history
 */
router.get('/my-purchases', authenticateToken, stateMapperMiddleware('purchase'), async (req, res) => {
  try {
    const user = req.user;
    const { status, page = 1, limit = 10 } = req.query;
    
    // Build filter
    const filter = { user: user._id };
    if (status) {
      filter.status = status;
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get purchases
    const purchases = await Purchase.find(filter)
      .populate('package', 'packageId name price currency')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count
    const totalCount = await Purchase.countDocuments(filter);
    
    // Transform purchases for response using PurchaseDTO
    const transformedPurchases = purchases.map(purchase => PurchaseDTO.forUser(purchase));
    
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
    logger.error('Get user purchases error:', {
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
 * GET /api/payments/purchase/:purchaseId
 * Get specific purchase details
 */
router.get('/purchase/:purchaseId', authenticateToken, async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const user = req.user;
    
    // Find purchase
    const purchase = await Purchase.findOne({
      purchaseId,
      user: user._id
    }).populate('package', 'packageId name price currency dailyBenefitRate benefitDays totalCycles');
    
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Compra no encontrada',
        code: 'PURCHASE_NOT_FOUND'
      });
    }
    
    // Get related transactions if purchase is active
    let transactions = [];
    if (purchase.status === 'ACTIVE') {
      transactions = await Transaction.find({
        purchaseId: purchase._id
      }).sort({ createdAt: -1 }).limit(10);
    }
    
    res.json({
      success: true,
      data: {
        purchase: {
          purchaseId: purchase.purchaseId,
          package: {
            packageId: purchase.package.packageId,
            name: purchase.package.name,
            dailyBenefitRate: purchase.package.dailyBenefitRate
          },
          quantity: purchase.quantity,
          unitPrice: purchase.unitPrice,
          totalAmount: purchase.totalAmount,
          currency: purchase.currency,
          status: purchase.status,
          paymentAddress: purchase.paymentAddress,
          transactionHash: purchase.transactionHash,
          benefitDetails: {
            benefitRate: purchase.benefitRate,
            benefitDays: purchase.benefitDays,
            totalCycles: purchase.totalCycles,
            currentCycle: purchase.currentCycle,
            currentDay: purchase.currentDay,
            totalBenefitAmount: purchase.totalBenefitAmount,
            accumulatedBenefits: purchase.accumulatedBenefits,
            remainingDays: purchase.remainingDays,
            remainingCycles: purchase.remainingCycles,
            progressPercentage: purchase.progressPercentage
          },
          timestamps: {
            createdAt: purchase.createdAt,
            hashSubmittedAt: purchase.hashSubmittedAt,
            activatedAt: purchase.activatedAt,
            completedAt: purchase.completedAt,
            expiresAt: purchase.expiresAt
          }
        },
        recentTransactions: transactions.map(tx => ({
          transactionId: tx.transactionId,
          type: tx.type,
          subtype: tx.subtype,
          amount: tx.amount,
          currency: tx.currency,
          status: tx.status,
          createdAt: tx.createdAt
        }))
      }
    });
    
  } catch (error) {
    logger.error('Get purchase details error:', {
      error: error.message,
      purchaseId: req.params.purchaseId,
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