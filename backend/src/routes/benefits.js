const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const licenseService = require('../services/licenseService');
const BenefitLedger = require('../models/BenefitLedger');
const License = require('../models/License');
const { validateObjectId } = require('../validators/common');
const logger = require('../utils/logger');

/**
 * @swagger
 * /api/user/benefits:
 *   get:
 *     summary: Obtener resumen completo de beneficios del usuario
 *     tags: [Benefits]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resumen de beneficios obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     summary:
 *                       type: object
 *                       properties:
 *                         activeLicenses:
 *                           type: number
 *                         availableBalance:
 *                           type: number
 *                         totalEarned:
 *                           type: number
 *                         totalWithdrawn:
 *                           type: number
 *                     schedules:
 *                       type: array
 *                       items:
 *                         type: object
 *                     history:
 *                       type: array
 *                       items:
 *                         type: object
 *                     licenses:
 *                       type: array
 *                       items:
 *                         type: object
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Obtener resumen completo
    const summary = await licenseService.getUserBenefitsSummary(userId);
    
    // Calcular totales adicionales
    const totalEarned = await BenefitLedger.aggregate([
      {
        $match: {
          userId: userId,
          status: { $in: ['available', 'withdrawn'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);
    
    const totalWithdrawn = await BenefitLedger.aggregate([
      {
        $match: {
          userId: userId,
          status: 'withdrawn'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);
    
    const response = {
      summary: {
        activeLicenses: summary.activeLicenses,
        availableBalance: summary.availableBalance,
        totalEarned: totalEarned[0]?.total || 0,
        totalWithdrawn: totalWithdrawn[0]?.total || 0,
        currency: 'USDT'
      },
      schedules: summary.upcomingBenefits.map(benefit => ({
        benefitId: benefit._id,
        licenseId: benefit.licenseId,
        benefitType: benefit.benefitType,
        amount: benefit.amount,
        currency: benefit.currency,
        benefitDate: benefit.benefitDate,
        cycle: benefit.cycle,
        day: benefit.day,
        status: benefit.status
      })),
      history: summary.recentBenefits.map(benefit => ({
        benefitId: benefit._id,
        licenseId: benefit.licenseId,
        benefitType: benefit.benefitType,
        amount: benefit.amount,
        currency: benefit.currency,
        benefitDate: benefit.benefitDate,
        processedAt: benefit.processedAt,
        cycle: benefit.cycle,
        day: benefit.day,
        status: benefit.status
      })),
      licenses: summary.licenses.map(license => ({
        licenseId: license.licenseId,
        packageName: license.packageId?.name,
        status: license.status,
        principalAmount: license.principalAmount,
        totalBenefitsEarned: license.totalBenefitsEarned,
        availableBalance: license.availableBalance,
        progressPercentage: license.progressPercentage,
        currentCycle: license.currentCycle,
        totalCycles: license.totalCycles,
        currentDay: license.currentDay,
        benefitDays: license.benefitDays,
        nextBenefitDate: license.nextBenefitDate,
        startDate: license.startDate,
        cashbackCompleted: license.cashbackCompleted,
        currency: license.currency
      }))
    };
    
    res.json({
      success: true,
      data: response
    });
    
  } catch (error) {
    logger.error('Error getting user benefits:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Error al obtener beneficios del usuario'
    });
  }
});

/**
 * @swagger
 * /api/user/benefits/history:
 *   get:
 *     summary: Obtener historial paginado de beneficios
 *     tags: [Benefits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [available, withdrawn, scheduled]
 *       - in: query
 *         name: benefitType
 *         schema:
 *           type: string
 *           enum: [cashback, daily_benefit]
 *     responses:
 *       200:
 *         description: Historial de beneficios obtenido exitosamente
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    
    // Filtros opcionales
    const filters = { userId };
    if (req.query.status) {
      filters.status = req.query.status;
    }
    if (req.query.benefitType) {
      filters.benefitType = req.query.benefitType;
    }
    
    // Obtener beneficios con paginación
    const [benefits, total] = await Promise.all([
      BenefitLedger.find(filters)
        .populate('licenseId', 'licenseId packageId')
        .populate({
          path: 'licenseId',
          populate: {
            path: 'packageId',
            select: 'name'
          }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      BenefitLedger.countDocuments(filters)
    ]);
    
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      success: true,
      data: {
        benefits: benefits.map(benefit => ({
          benefitId: benefit._id,
          licenseId: benefit.licenseId?.licenseId,
          packageName: benefit.licenseId?.packageId?.name,
          benefitType: benefit.benefitType,
          amount: benefit.amount,
          currency: benefit.currency,
          benefitDate: benefit.benefitDate,
          processedAt: benefit.processedAt,
          cycle: benefit.cycle,
          day: benefit.day,
          status: benefit.status,
          createdAt: benefit.createdAt
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
    
  } catch (error) {
    logger.error('Error getting benefits history:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Error al obtener historial de beneficios'
    });
  }
});

/**
 * @swagger
 * /api/user/benefits/licenses:
 *   get:
 *     summary: Obtener licencias activas del usuario
 *     tags: [Benefits]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Licencias obtenidas exitosamente
 */
router.get('/licenses', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const licenses = await License.find({ userId })
      .populate('packageId', 'name price currency dailyBenefitRate benefitDays totalCycles')
      .populate('purchaseId', 'purchaseId amount createdAt')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: licenses.map(license => ({
        licenseId: license.licenseId,
        packageName: license.packageId?.name,
        packagePrice: license.packageId?.price,
        purchaseId: license.purchaseId?.purchaseId,
        status: license.status,
        principalAmount: license.principalAmount,
        totalBenefitsEarned: license.totalBenefitsEarned,
        totalBenefitsWithdrawn: license.totalBenefitsWithdrawn,
        availableBalance: license.availableBalance,
        progressPercentage: license.progressPercentage,
        currentCycle: license.currentCycle,
        totalCycles: license.totalCycles,
        currentDay: license.currentDay,
        benefitDays: license.benefitDays,
        daysRemaining: license.daysRemaining,
        nextBenefitDate: license.nextBenefitDate,
        startDate: license.startDate,
        completionDate: license.completionDate,
        cashbackCompleted: license.cashbackCompleted,
        pausedAt: license.pausedAt,
        pausedReason: license.pausedReason,
        currency: license.currency,
        createdAt: license.createdAt
      }))
    });
    
  } catch (error) {
    logger.error('Error getting user licenses:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Error al obtener licencias del usuario'
    });
  }
});

module.exports = router;