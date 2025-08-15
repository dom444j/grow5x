/**
 * Packages Routes
 * Handles license package catalog and information
 */

const express = require('express');
const { Package } = require('../models');
const { optionalAuth } = require('../middleware/auth');
const logger = require('../config/logger');

const router = express.Router();

/**
 * GET /api/packages
 * Get all available packages
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    // Get query parameters
    const {
      active = 'true',
      visible = 'true',
      sort = 'sortOrder'
    } = req.query;
    
    // Build filter
    const filter = {};
    
    if (active === 'true') {
      filter.isActive = true;
    }
    
    if (visible === 'true') {
      filter.isVisible = true;
    }
    
    // Build sort
    const sortOptions = {};
    switch (sort) {
      case 'price_asc':
        sortOptions.price = 1;
        break;
      case 'price_desc':
        sortOptions.price = -1;
        break;
      case 'name':
        sortOptions.name = 1;
        break;
      default:
        sortOptions.sortOrder = 1;
        sortOptions.createdAt = 1;
    }
    
    // Fetch packages
    const packages = await Package.find(filter)
      .sort(sortOptions)
      .select('-__v -updatedAt');
    
    // Transform packages for response
    const transformedPackages = packages.map(pkg => ({
      packageId: pkg.packageId,
      name: pkg.name,
      price: pkg.price,
      currency: pkg.currency,
      dailyBenefitRate: pkg.dailyBenefitRate,
      dailyBenefitPercentage: (pkg.dailyBenefitRate * 100).toFixed(1),
      benefitDays: pkg.benefitDays,
      totalCycles: pkg.totalCycles,
      totalDurationDays: pkg.totalDurationDays,
      totalBenefitAmount: pkg.totalBenefitAmount,
      totalROI: pkg.totalROI,
      commissionRates: pkg.commissionRates,
      description: pkg.description,
      features: pkg.features,
      minPurchase: pkg.minPurchase,
      maxPurchase: pkg.maxPurchase,
      isActive: pkg.isActive,
      isVisible: pkg.isVisible,
      createdAt: pkg.createdAt
    }));
    
    logger.debug('Packages fetched', {
      count: packages.length,
      userId: req.user?.userId,
      ip: req.ip
    });
    
    res.json({
      success: true,
      data: {
        packages: transformedPackages,
        count: transformedPackages.length
      }
    });
    
  } catch (error) {
    logger.error('Get packages error:', {
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
 * GET /api/packages/:packageId
 * Get specific package details
 */
router.get('/:packageId', optionalAuth, async (req, res) => {
  try {
    const { packageId } = req.params;
    
    // Find package by packageId
    const package = await Package.findOne({ packageId })
      .select('-__v -updatedAt');
    
    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Paquete no encontrado',
        code: 'PACKAGE_NOT_FOUND'
      });
    }
    
    // Check if package is visible (unless user is admin)
    if (!package.isVisible && req.user?.role !== 'admin') {
      return res.status(404).json({
        success: false,
        message: 'Paquete no encontrado',
        code: 'PACKAGE_NOT_FOUND'
      });
    }
    
    // Transform package for response
    const transformedPackage = {
      packageId: package.packageId,
      name: package.name,
      price: package.price,
      currency: package.currency,
      dailyBenefitRate: package.dailyBenefitRate,
      dailyBenefitPercentage: (package.dailyBenefitRate * 100).toFixed(1),
      benefitDays: package.benefitDays,
      totalCycles: package.totalCycles,
      totalDurationDays: package.totalDurationDays,
      totalBenefitAmount: package.totalBenefitAmount,
      totalROI: package.totalROI,
      commissionRates: package.commissionRates,
      description: package.description,
      features: package.features,
      minPurchase: package.minPurchase,
      maxPurchase: package.maxPurchase,
      isActive: package.isActive,
      isVisible: package.isVisible,
      createdAt: package.createdAt,
      
      // Additional calculated fields
      calculations: {
        dailyBenefitAmount: package.price * package.dailyBenefitRate,
        totalInvestment: package.price,
        totalReturn: package.price + package.totalBenefitAmount,
        netProfit: package.totalBenefitAmount,
        breakEvenDays: Math.ceil(1 / package.dailyBenefitRate),
        
        // Commission breakdown for each level
        commissionBreakdown: Object.entries(package.commissionRates).map(([level, rate]) => ({
          level: level.replace('level', 'Nivel '),
          rate: rate,
          percentage: (rate * 100).toFixed(1),
          amount: package.price * rate
        }))
      }
    };
    
    logger.debug('Package details fetched', {
      packageId,
      userId: req.user?.userId,
      ip: req.ip
    });
    
    res.json({
      success: true,
      data: {
        package: transformedPackage
      }
    });
    
  } catch (error) {
    logger.error('Get package details error:', {
      error: error.message,
      packageId: req.params.packageId,
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
 * GET /api/packages/:packageId/commission-calculator
 * Calculate potential commissions for a package
 */
router.get('/:packageId/commission-calculator', optionalAuth, async (req, res) => {
  try {
    const { packageId } = req.params;
    const { referrals = 1 } = req.query;
    
    // Validate referrals parameter
    const referralCount = Math.max(1, Math.min(100, parseInt(referrals) || 1));
    
    // Find package
    const package = await Package.findOne({ packageId, isActive: true });
    
    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Paquete no encontrado',
        code: 'PACKAGE_NOT_FOUND'
      });
    }
    
    // Calculate commissions for each level
    const commissionCalculations = Object.entries(package.commissionRates).map(([level, rate]) => {
      const levelNumber = parseInt(level.replace('level', ''));
      const commissionPerReferral = package.price * rate;
      const totalCommission = commissionPerReferral * referralCount;
      
      return {
        level: levelNumber,
        levelName: `Nivel ${levelNumber}`,
        rate: rate,
        percentage: (rate * 100).toFixed(1),
        commissionPerReferral: commissionPerReferral,
        totalCommission: totalCommission,
        referralCount: referralCount
      };
    });
    
    // Calculate totals
    const totalCommissionPerReferral = commissionCalculations.reduce(
      (sum, calc) => sum + calc.commissionPerReferral, 0
    );
    const totalCommissionAll = commissionCalculations.reduce(
      (sum, calc) => sum + calc.totalCommission, 0
    );
    
    res.json({
      success: true,
      data: {
        package: {
          packageId: package.packageId,
          name: package.name,
          price: package.price,
          currency: package.currency
        },
        calculations: {
          referralCount: referralCount,
          commissionLevels: commissionCalculations,
          totals: {
            commissionPerReferral: totalCommissionPerReferral,
            totalCommissionAll: totalCommissionAll,
            commissionPercentage: ((totalCommissionPerReferral / package.price) * 100).toFixed(2)
          }
        }
      }
    });
    
  } catch (error) {
    logger.error('Commission calculator error:', {
      error: error.message,
      packageId: req.params.packageId,
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
 * GET /api/packages/stats/summary
 * Get package statistics summary
 */
router.get('/stats/summary', optionalAuth, async (req, res) => {
  try {
    // Get package statistics
    const stats = await Package.aggregate([
      {
        $match: { isActive: true }
      },
      {
        $group: {
          _id: null,
          totalPackages: { $sum: 1 },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
          avgPrice: { $avg: '$price' },
          avgDailyRate: { $avg: '$dailyBenefitRate' },
          avgROI: { $avg: '$totalROI' },
          totalRevenue: { $sum: '$totalRevenue' }
        }
      }
    ]);
    
    const summary = stats[0] || {
      totalPackages: 0,
      minPrice: 0,
      maxPrice: 0,
      avgPrice: 0,
      avgDailyRate: 0,
      avgROI: 0,
      totalRevenue: 0
    };
    
    // Get individual package summaries
    const packages = await Package.find({ isActive: true })
      .select('packageId name price totalROI totalRevenue purchaseCount')
      .sort({ sortOrder: 1 });
    
    res.json({
      success: true,
      data: {
        summary: {
          totalPackages: summary.totalPackages,
          priceRange: {
            min: summary.minPrice,
            max: summary.maxPrice,
            average: Math.round(summary.avgPrice * 100) / 100
          },
          averageMetrics: {
            dailyRate: (summary.avgDailyRate * 100).toFixed(2),
            roi: summary.avgROI.toFixed(2)
          },
          totalRevenue: summary.totalRevenue
        },
        packages: packages.map(pkg => ({
          packageId: pkg.packageId,
          name: pkg.name,
          price: pkg.price,
          totalROI: pkg.totalROI,
          totalRevenue: pkg.totalRevenue || 0,
          purchaseCount: pkg.purchaseCount || 0
        }))
      }
    });
    
  } catch (error) {
    logger.error('Package stats error:', {
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