/**
 * Referral Routes
 * Handles referral link redirections and attribution
 */

const express = require('express');
const { User } = require('../models');
const logger = require('../config/logger');

const router = express.Router();

/**
 * GET /r/:code
 * Redirect referral code to registration page with ref parameter
 */
router.get('/r/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    // Validate referral code format
    if (!code || code.length < 3) {
      logger.warn('Invalid referral code format', {
        code,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.redirect('/register?error=invalid_ref');
    }
    
    // Check if referral code exists
    const referrer = await User.findOne({ 
      referralCode: code.toUpperCase(),
      isActive: true 
    });
    
    if (!referrer) {
      logger.warn('Referral code not found', {
        code,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.redirect('/register?error=ref_not_found');
    }
    
    // Log successful referral link access
    logger.info('Referral link accessed', {
      referralCode: code,
      referrerId: referrer.userId,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    // Redirect to registration with referral code
    const redirectUrl = `/register?ref=${code.toUpperCase()}`;
    
    // Set referral cookie (30 days)
    res.cookie('g5x_ref', code.toUpperCase(), {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: false, // Allow frontend to read
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    
    // Set UTM tracking if present
    const utmParams = new URLSearchParams();
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(param => {
      if (req.query[param]) {
        utmParams.append(param, req.query[param]);
      }
    });
    
    if (utmParams.toString()) {
      res.cookie('g5x_utm', utmParams.toString(), {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
    }
    
    res.redirect(redirectUrl);
    
  } catch (error) {
    logger.error('Referral redirect error:', {
      error: error.message,
      code: req.params.code,
      ip: req.ip
    });
    
    res.redirect('/register?error=system_error');
  }
});

/**
 * GET /api/referrals/validate/:code
 * Validate referral code (API endpoint for frontend)
 */
router.get('/api/referrals/validate/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    if (!code || code.length < 3) {
      return res.json({
        success: false,
        valid: false,
        message: 'Código de referido inválido'
      });
    }
    
    const referrer = await User.findOne({ 
      referralCode: code.toUpperCase(),
      isActive: true 
    }).select('userId firstName lastName referralCode');
    
    if (!referrer) {
      return res.json({
        success: false,
        valid: false,
        message: 'Código de referido no encontrado'
      });
    }
    
    res.json({
      success: true,
      valid: true,
      message: 'Código de referido válido',
      referrer: {
        userId: referrer.userId,
        firstName: referrer.firstName,
        lastName: referrer.lastName,
        referralCode: referrer.referralCode
      }
    });
    
  } catch (error) {
    logger.error('Referral validation error:', {
      error: error.message,
      code: req.params.code,
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      valid: false,
      message: 'Error interno del servidor'
    });
  }
});

module.exports = router;