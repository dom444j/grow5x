/**
 * Public API Routes
 * Endpoints that don't require authentication
 */

const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const { toApiNumber } = require('../utils/decimal');

/**
 * GET /api/public/config - Public configuration for frontend
 * Returns network settings, currency info, withdrawal limits and SLA disclaimer
 */
router.get('/config', async (req, res) => {
  try {
    const config = {
      network: 'BEP20',
      currency: 'USDT',
      withdrawMinUSDTBEP20: 10,
      withdrawMaxUSDTBEP20: 10000,
      withdrawSlaTargetsMinutes: [15, 30, 60, 180, 360, 720, 1440],
      legal: {
        withdrawSlaDisclaimer: 'Los tiempos son un objetivo operativo (SLA). El procesamiento es manual por un administrador y no constituye garantía.'
      }
    };

    res.json(config);
    
  } catch (error) {
    logger.error('Public config error:', {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'CONFIG_ERROR'
    });
  }
});

/**
 * GET /api/public/packages - Public packages endpoint
 * Returns available packages with slug field for checkout
 */
router.get('/packages', async (req, res) => {
  try {
    const { Package } = require('../models');
    
    // Get only active and visible packages
    const packages = await Package.find({
      isActive: true,
      isVisible: true
    })
    .select('packageId name slug price currency priceUSDT payoutWindowMin features sortOrder')
    .sort({ sortOrder: 1, createdAt: 1 });

    // Transform packages for public response
    const items = packages.map(pkg => ({
      slug: pkg.slug,
      name: pkg.name,
      priceUSDT: toApiNumber(pkg.priceUSDT || pkg.price),
      payoutWindowMin: pkg.payoutWindowMin,
      features: pkg.features || []
    }));

    res.json({
      success: true,
      data: {
        items
      }
    });
    
  } catch (error) {
    logger.error('Public packages error:', {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'PACKAGES_ERROR'
    });
  }
});

module.exports = router;