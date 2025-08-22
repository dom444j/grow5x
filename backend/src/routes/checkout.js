const express = require('express');
const { z } = require('zod');
const { Purchase, Package, Wallet, User } = require('../models');
const logger = require('../config/logger');
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');
const { paymentLimiter } = require('../middleware/rateLimiter');
const { validatePaymentRequest } = require('../middleware/usdtBep20Hardening');
const walletPool = require('../services/walletPool');
const { isValidObjectId } = require('mongoose');
const { toApiNumber, DecimalCalc } = require('../utils/decimal');
const { mapPurchaseState } = require('../utils/stateMapper');
const transactionService = require('../services/transactionService');
const realtimeSyncService = require('../services/realtimeSyncService');
const { middleware: responseStandardizer } = require('../middleware/responseStandardizer');

const router = express.Router();

// Validation schemas
const startCheckoutSchema = z.object({
  packageId: z.string().min(1, 'Package ID es requerido'),
  amountUSDT: z.number().min(1, 'Monto debe ser mayor a 0')
});

const confirmTxSchema = z.object({
  txHash: z.string().min(1, 'Hash de transacción es requerido')
});

/**
 * POST /api/checkout/start
 * Endpoint para crear orden y asignar wallet
 */
router.post('/start', authenticateToken, paymentLimiter, validatePaymentRequest, responseStandardizer, async (req, res, next) => {
  try {
    console.log('[CHECKOUT/START] body:', req.body, 'userId:', req.userId);

    const packageId = req.body.packageId;
    const amountUSDT = Number(req.body.amountUSDT ?? req.body.amount ?? req.body.price);

    if (!packageId) return res.status(400).json({ error: 'BAD_REQUEST', field: 'packageId' });
    if (!Number.isFinite(amountUSDT) || amountUSDT <= 0)
      return res.status(400).json({ error: 'BAD_REQUEST', field: 'amountUSDT' });

    const user = await User.findOne({ userId: req.userId });
    if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });

    // Busca por slug o code; si parece ObjectId, también por _id
    const or = [{ slug: packageId }, { code: packageId }];
    if (isValidObjectId(packageId)) or.push({ _id: packageId });

    const pkg = await Package.findOne({ isActive: true, $or: or }).lean();
    if (!pkg) return res.status(400).json({ error: 'INVALID_PACKAGE', received: packageId });

    // Validate amount matches package price
    if (Math.abs(amountUSDT - pkg.price) > 0.01) {
      return res.status(400).json({ error: 'AMOUNT_MISMATCH', expected: pkg.price, received: amountUSDT });
    }

    let selectedWallet;
    try {
      selectedWallet = await walletPool.pick({ userId: user.userId, amountUSDT });
      // esperado: { address, network, currency }
    } catch (e) {
      console.error('[POOL] assign failed:', e);
      return res.status(503).json({ 
        error: 'POOL_UNAVAILABLE', 
        detail: String(e?.message || e) 
      });
    }
    if (!selectedWallet?.address) {
      return res.status(503).json({ error: 'NO_WALLETS_AVAILABLE' });
    }

    // Pool V2: Sin locks, deadline fijo de 30 minutos
    const paymentDeadline = new Date(Date.now() + 30 * 60 * 1000);

    const mongoose = require('mongoose');
    
    // Use transaction service to create purchase
    const result = await transactionService.executeTransaction(async (session) => {
      const p = await Purchase.create([{
        userId: user._id, // Use ObjectId for consistency
        packageId: pkg._id, // Use ObjectId from package document
        quantity: 1,
        unitPrice: mongoose.Types.Decimal128.fromString(pkg.price.toString()),
        totalAmount: mongoose.Types.Decimal128.fromString(pkg.price.toString()),
        currency: 'USDT',
        assignedWallet: selectedWallet._id,
        displayWalletId: selectedWallet.walletId, // Use string walletId
        paymentAddress: selectedWallet.address,
        status: 'PENDING_PAYMENT',
        paymentDeadline,
        benefitPlan: {
          dailyRate: pkg.dailyBenefitRate || 0,
          daysPerCycle: pkg.benefitDays || 0,
          totalCycles: pkg.totalCycles || 0,
          totalBenefitAmount: mongoose.Types.Decimal128.fromString(DecimalCalc.multiply(pkg.price, (pkg.dailyBenefitRate || 0) * (pkg.benefitDays || 0) * (pkg.totalCycles || 0)).toString())
        },
        currentCycle: 0,
        currentDay: 0,
        totalBenefitsPaid: mongoose.Types.Decimal128.fromString('0'),
        commissionsGenerated: [],
        totalCommissionAmount: mongoose.Types.Decimal128.fromString('0')
      }], { session });
      
      return p[0];
    });

    // Emit real-time event
    realtimeSyncService.sendUserUpdate(user.userId, {
      type: 'purchase_created',
      orderId: result.id,
      status: result.status,
      totalAmount: toApiNumber(result.totalAmount),
      paymentDeadline: result.paymentDeadline
    });

    return res.success({
      checkout: {
        orderId: result.id, 
        status: result.status, 
        expiresAt: result.paymentDeadline,
        next: { 
          action: 'AWAIT_PAYMENT', 
          pollUrl: `/api/checkout/${result.id}/status` 
        }
      },
      payment: {
        network: 'BEP20', 
        walletAddress: result.paymentAddress,
        amountUSDT: toApiNumber(result.totalAmount),
        qr: `usdt:bep20:${result.paymentAddress}?amount=${toApiNumber(result.totalAmount)}`
      }
    }, 201);
  } catch (err) {
    console.error('[CHECKOUT/START][ERROR]', { 
      name: err?.name, 
      msg: err?.message, 
      code: err?.code, 
      errors: err?.errors,
      userId: req.userId,
      body: req.body
    });
    next(err);
  }
});

/**
 * POST /api/checkout/:orderId/confirm
 * Endpoint para confirmar transacción con hash
 */
router.post('/:orderId/confirm', authenticateToken, async (req, res, next) => {
  try {
    const { txHash } = req.body;
    const p = await Purchase.findOne({ _id: req.params.orderId, userId: req.userId });
    if (!p) {
      return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
    }

    // Check if txHash already exists
    const existingPurchase = await Purchase.findOne({
      txHash,
      _id: { $ne: p._id }
    });

    if (existingPurchase) {
      return res.status(400).json({
        error: 'TX_HASH_ALREADY_EXISTS',
        message: 'Este hash de transacción ya está siendo usado en otra compra'
      });
    }

    // Use transaction service for status update
    const transactionId = await transactionService.startTransaction('purchase_confirmation');
    
    try {
      p.txHash = txHash; 
      p.status = 'CONFIRMING'; 
      await p.save();
      
      await transactionService.commitTransaction(transactionId);
      
      // Emit real-time event
      realtimeSyncService.emitUserUpdate(req.userId, {
        type: 'purchase_confirmed',
        orderId: p.id,
        status: p.status,
        txHash: txHash
      });
      
      res.success({ confirmed: true });
    } catch (error) {
      await transactionService.rollbackTransaction(transactionId);
      throw error;
    }
  } catch (e) { 
    next(e); 
  }
});

/**
 * GET /api/checkout/:orderId/status
 * Obtener el estado de una orden
 */
router.get('/:orderId/status', authenticateToken, responseStandardizer, async (req, res) => {
  const errorRef = crypto.randomBytes(4).toString('hex');
  try {
    console.log('[CHECKOUT/STATUS] orderId:', req.params.orderId, 'userId:', req.user?.userId, 'ref:', errorRef);

    const purchase = await Purchase.findOne({
      _id: req.params.orderId,
      userId: req.userId
    }).lean();

    if (!purchase) {
      return res.status(404).json({
        error: 'ORDER_NOT_FOUND',
        message: 'Orden no encontrada o no pertenece al usuario',
        ref: errorRef
      });
    }

    // Verificar expiración
    const now = new Date();
    if (purchase.expiresAt && now > purchase.expiresAt && purchase.status === 'PENDING_PAYMENT') {
      // Marcar como expirada
      await Purchase.updateOne(
        { _id: req.params.orderId },
        { status: 'EXPIRED' }
      );
      purchase.status = 'EXPIRED';
    }

    const response = {
      orderId: purchase._id,
      status: mapPurchaseState(purchase.status),
      packageId: purchase.packageId,
      amountUSDT: toApiNumber(purchase.amountUSDT || purchase.totalAmount),
      network: purchase.network,
      payTo: purchase.payTo || purchase.paymentAddress,
      txHash: purchase.txHash,
      expiresAt: purchase.expiresAt,
      createdAt: purchase.createdAt,
      updatedAt: purchase.updatedAt
    };

    // Agregar información específica según el estado
    if (purchase.status === 'PENDING_PAYMENT') {
      response.next = {
        action: 'AWAIT_PAYMENT',
        pollUrl: `/api/checkout/${purchase._id}/status`
      };
      response.payment = {
        network: purchase.network || 'BEP20',
        walletAddress: purchase.payTo || purchase.paymentAddress,
        amountUSDT: toApiNumber(purchase.amountUSDT || purchase.totalAmount),
        qr: `usdt:bep20:${purchase.payTo || purchase.paymentAddress}?amount=${toApiNumber(purchase.amountUSDT || purchase.totalAmount)}`
      };
    }

    console.log('[CHECKOUT/STATUS] response:', response, 'ref:', errorRef);
    res.success(response);

  } catch (error) {
    console.error('[CHECKOUT/STATUS] Error:', error, 'ref:', errorRef);
    res.error('Error interno del servidor', 500, { ref: errorRef });
  }
});

module.exports = router;