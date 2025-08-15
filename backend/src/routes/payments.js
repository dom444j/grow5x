/**
 * Payments Routes
 * Handles payment submissions, confirmations, and wallet assignments
 */

const express = require('express');
const { z } = require('zod');
const { Package, Wallet, Purchase, User, Commission, Transaction } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../config/logger');

const router = express.Router();

// Validation schemas
const submitPaymentSchema = z.object({
  packageId: z.string().min(1, 'Package ID es requerido'),
  quantity: z.number().int().min(1, 'Cantidad debe ser al menos 1').max(10, 'Cantidad máxima es 10')
});

const confirmHashSchema = z.object({
  purchaseId: z.string().min(1, 'Purchase ID es requerido'),
  transactionHash: z.string().min(1, 'Hash de transacción es requerido')
});

/**
 * POST /api/payments/submit
 * Submit a payment request and get assigned wallet
 */
router.post('/submit', authenticateToken, async (req, res) => {
  try {
    // Validate request body
    const validatedData = submitPaymentSchema.parse(req.body);
    const { packageId, quantity } = validatedData;
    
    const user = req.user;
    
    // Find the package
    const package = await Package.findOne({ packageId, isActive: true });
    
    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Paquete no encontrado o no disponible',
        code: 'PACKAGE_NOT_FOUND'
      });
    }
    
    // Validate quantity limits
    if (quantity < package.minPurchase || quantity > package.maxPurchase) {
      return res.status(400).json({
        success: false,
        message: `Cantidad debe estar entre ${package.minPurchase} y ${package.maxPurchase}`,
        code: 'INVALID_QUANTITY'
      });
    }
    
    // Check if user has pending purchases for this package
    const pendingPurchase = await Purchase.findOne({
      user: user._id,
      package: package._id,
      status: 'pending'
    });
    
    if (pendingPurchase) {
      return res.status(400).json({
        success: false,
        message: 'Ya tienes una compra pendiente para este paquete',
        code: 'PENDING_PURCHASE_EXISTS'
      });
    }
    
    // Get next available wallet
    const wallet = await Wallet.getNextAvailable();
    
    if (!wallet) {
      logger.error('No available wallets for payment', {
        userId: user.userId,
        packageId,
        quantity
      });
      
      return res.status(503).json({
        success: false,
        message: 'No hay wallets disponibles en este momento. Intenta más tarde.',
        code: 'NO_WALLET_AVAILABLE'
      });
    }
    
    // Calculate amounts
    const unitPrice = package.price;
    const totalAmount = unitPrice * quantity;
    
    // Create purchase record
    const purchase = new Purchase({
      user: user._id,
      package: package._id,
      quantity: quantity,
      unitPrice: unitPrice,
      totalAmount: totalAmount,
      currency: package.currency,
      assignedWallet: wallet._id,
      paymentAddress: wallet.address,
      status: 'pending',
      benefitRate: package.dailyBenefitRate,
      benefitDays: package.benefitDays,
      totalCycles: package.totalCycles,
      totalBenefitAmount: package.totalBenefitAmount * quantity,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });
    
    await purchase.save();
    
    // Assign wallet to this purchase
    await wallet.assignTo(purchase._id, user._id);
    
    logger.info('Payment submitted successfully', {
      userId: user.userId,
      purchaseId: purchase.purchaseId,
      packageId: package.packageId,
      quantity,
      totalAmount,
      walletAddress: wallet.address
    });
    
    res.status(201).json({
      success: true,
      message: 'Solicitud de pago creada exitosamente',
      data: {
        purchase: {
          purchaseId: purchase.purchaseId,
          packageName: package.name,
          quantity: purchase.quantity,
          unitPrice: purchase.unitPrice,
          totalAmount: purchase.totalAmount,
          currency: purchase.currency,
          status: purchase.status,
          expiresAt: purchase.expiresAt,
          createdAt: purchase.createdAt
        },
        payment: {
          walletAddress: wallet.address,
          network: wallet.network,
          networkName: wallet.networkName,
          tokenContract: wallet.tokenContract,
          tokenSymbol: wallet.tokenSymbol,
          amount: purchase.totalAmount,
          currency: purchase.currency
        },
        instructions: {
          steps: [
            `Envía exactamente ${purchase.totalAmount} ${purchase.currency} a la dirección proporcionada`,
            'Usa la red ' + wallet.networkName + ' (' + wallet.network + ')',
            'Copia el hash de la transacción una vez confirmada',
            'Regresa aquí y proporciona el hash para confirmar tu pago',
            'El pago expira en 24 horas'
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
    logger.error('Submit payment error:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.userId,
      body: req.body,
      ip: req.ip
    });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Datos de pago inválidos',
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
 * POST /api/payments/confirm-hash
 * Submit transaction hash for payment confirmation
 */
router.post('/confirm-hash', authenticateToken, async (req, res) => {
  try {
    // Validate request body
    const validatedData = confirmHashSchema.parse(req.body);
    const { purchaseId, transactionHash } = validatedData;
    
    const user = req.user;
    
    // Find the purchase
    const purchase = await Purchase.findOne({
      purchaseId,
      user: user._id
    }).populate('package');
    
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Compra no encontrada',
        code: 'PURCHASE_NOT_FOUND'
      });
    }
    
    // Check if purchase is in pending status
    if (purchase.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `La compra está en estado ${purchase.status}, no se puede confirmar`,
        code: 'INVALID_PURCHASE_STATUS'
      });
    }
    
    // Check if purchase has expired
    if (purchase.expiresAt && new Date() > purchase.expiresAt) {
      // Mark as expired
      purchase.status = 'expired';
      await purchase.save();
      
      // Release the wallet
      if (purchase.assignedWallet) {
        const wallet = await Wallet.findById(purchase.assignedWallet);
        if (wallet) {
          await wallet.release();
        }
      }
      
      return res.status(400).json({
        success: false,
        message: 'La compra ha expirado',
        code: 'PURCHASE_EXPIRED'
      });
    }
    
    // Check if transaction hash is already used
    const existingPurchase = await Purchase.findOne({
      transactionHash: transactionHash.toLowerCase(),
      _id: { $ne: purchase._id }
    });
    
    if (existingPurchase) {
      return res.status(400).json({
        success: false,
        message: 'Este hash de transacción ya ha sido usado',
        code: 'TRANSACTION_HASH_EXISTS'
      });
    }
    
    // Update purchase with transaction hash
    purchase.transactionHash = transactionHash.toLowerCase();
    purchase.status = 'hash_submitted';
    purchase.hashSubmittedAt = new Date();
    
    await purchase.save();
    
    logger.info('Transaction hash submitted', {
      userId: user.userId,
      purchaseId: purchase.purchaseId,
      transactionHash: transactionHash,
      amount: purchase.totalAmount
    });
    
    res.json({
      success: true,
      message: 'Hash de transacción enviado exitosamente',
      data: {
        purchase: {
          purchaseId: purchase.purchaseId,
          status: purchase.status,
          transactionHash: purchase.transactionHash,
          hashSubmittedAt: purchase.hashSubmittedAt,
          totalAmount: purchase.totalAmount,
          currency: purchase.currency
        },
        nextSteps: [
          'Tu hash de transacción ha sido recibido',
          'Nuestro equipo verificará la transacción en la blockchain',
          'Recibirás una notificación una vez confirmada',
          'El proceso puede tomar entre 10-30 minutos'
        ]
      }
    });
    
  } catch (error) {
    logger.error('Confirm hash error:', {
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
router.get('/my-purchases', authenticateToken, async (req, res) => {
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
    
    // Transform purchases for response
    const transformedPurchases = purchases.map(purchase => ({
      purchaseId: purchase.purchaseId,
      package: {
        packageId: purchase.package.packageId,
        name: purchase.package.name
      },
      quantity: purchase.quantity,
      unitPrice: purchase.unitPrice,
      totalAmount: purchase.totalAmount,
      currency: purchase.currency,
      status: purchase.status,
      paymentAddress: purchase.paymentAddress,
      transactionHash: purchase.transactionHash,
      benefitProgress: {
        currentCycle: purchase.currentCycle,
        currentDay: purchase.currentDay,
        totalCycles: purchase.totalCycles,
        benefitDays: purchase.benefitDays,
        remainingDays: purchase.remainingDays,
        remainingCycles: purchase.remainingCycles
      },
      createdAt: purchase.createdAt,
      activatedAt: purchase.activatedAt,
      expiresAt: purchase.expiresAt
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
    if (purchase.status === 'active' || purchase.status === 'completed') {
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