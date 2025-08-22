const mongoose = require('mongoose');
const Purchase = require('../models/Purchase');
const License = require('../models/License');
const BenefitLedger = require('../models/BenefitLedger');
const User = require('../models/User');
const Package = require('../models/Package');
const LicenseDataMapper = require('../services/LicenseDataMapper');
const LicenseDTO = require('../dto/LicenseDTO');

/**
 * Get all licenses (active purchases) with pagination and filtering
 * GET /api/admin/licenses?status=&q=&page=&limit=
 */
const getLicenses = async (req, res) => {
  try {
    const {
      status = '',
      q = '',
      page = 1,
      limit = 20
    } = req.query;

    // Build query
    const query = {
      status: { $in: ['ACTIVE', 'PAUSED', 'COMPLETED'] } // Only active licenses
    };

    // Filter by status if provided
    if (status) {
      query.status = status;
    }

    // Search by user email if query provided
    if (q) {
      const users = await User.find({
        email: { $regex: q, $options: 'i' }
      }).select('_id');
      
      if (users.length > 0) {
        query.userId = { $in: users.map(u => u._id) };
      } else {
        // No users found, return empty result
        return res.json({
          licenses: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            pages: 0
          }
        });
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await License.countDocuments(query);
    const pages = Math.ceil(total / parseInt(limit));

    // Get licenses with user and package data
    const licenses = await License.find(query)
      .populate('userId', 'email firstName lastName')
      .populate('packageId', 'name')
      .populate('purchaseId', 'totalAmount createdAt paymentAddress txHash')
      .populate({
        path: 'purchaseId',
        populate: {
          path: 'assignedWallet',
          select: 'address network'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Enrich with unified license data using LicenseDTO
    const enrichedLicenses = await Promise.all(
      licenses.map(async (license) => {
        const stats = await LicenseDataMapper.calculateLicenseStats(
          license._id, 
          license.principalAmount || license.purchaseId?.totalAmount || 0
        );
        
        return LicenseDTO.forAdmin(license, stats);
      })
    );

    res.json({
      licenses: enrichedLicenses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages
      }
    });
  } catch (error) {
    console.error('Error getting licenses:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get single license details
 * GET /api/admin/licenses/:id
 */
const getLicense = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid license ID' });
    }

    const license = await License.findById(id)
      .populate('userId', 'email firstName lastName')
      .populate('packageId', 'name dailyRate')
      .populate('purchaseId', 'totalAmount createdAt')
      .lean();

    if (!license) {
      return res.status(404).json({ error: 'License not found' });
    }

    // Get benefit history
    const benefits = await BenefitLedger.find({
      licenseId: license._id,
      type: 'DAILY_BENEFIT'
    })
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();

    // Calculate license stats
    const stats = await LicenseDataMapper.calculateLicenseStats(
      license._id,
      license.principalAmount || license.purchaseId?.totalAmount || 0
    );

    // Create standardized response using LicenseDTO
    const licenseData = LicenseDTO.forAdmin(license, stats);

    res.json({
      success: true,
      data: {
        ...licenseData,
        benefitHistory: benefits.map(benefit => ({
          _id: benefit._id?.toString() || benefit._id,
          amount: benefit.amount,
          type: benefit.type,
          createdAt: benefit.createdAt?.toISOString() || benefit.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('Error getting license:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Pause a license
 * POST /api/admin/licenses/:id/pause
 */
const pauseLicense = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid license ID' });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Reason is required' });
    }

    const license = await License.findById(id);
    if (!license) {
      return res.status(404).json({ error: 'License not found' });
    }

    if (license.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Only active licenses can be paused' });
    }

    // Update license status
    license.status = 'PAUSED';
    license.adminNotes = `${license.adminNotes || ''}\n[${new Date().toISOString()}] PAUSED by admin: ${reason}`.trim();
    license.pausedAt = new Date();
    license.pausedBy = req.user._id;
    license.pauseReason = reason;

    await license.save();

    // Emit SSE event for license pause
    try {
      const { emitToUser } = require('../utils/socketManager');
      await emitToUser(license.userId.toString(), 'licensePaused', {
        type: 'licensePaused',
        data: {
          licenseId: license._id,
          purchaseId: license.purchaseId,
          status: license.status,
          reason: reason,
          pausedAt: license.pausedAt
        },
        timestamp: new Date().toISOString()
      });
    } catch (sseError) {
      console.warn('Failed to emit license pause SSE event:', {
        licenseId: license._id,
        userId: license.userId,
        error: sseError.message
      });
    }

    res.json({ message: 'License paused successfully', license });
  } catch (error) {
    console.error('Error pausing license:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Resume a license
 * POST /api/admin/licenses/:id/resume
 */
const resumeLicense = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid license ID' });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Reason is required' });
    }

    const license = await License.findById(id);
    if (!license) {
      return res.status(404).json({ error: 'License not found' });
    }

    if (license.status !== 'PAUSED') {
      return res.status(400).json({ error: 'Only paused licenses can be resumed' });
    }

    // Update license status
    license.status = 'ACTIVE';
    license.adminNotes = `${license.adminNotes || ''}\n[${new Date().toISOString()}] RESUMED by admin: ${reason}`.trim();
    license.resumedAt = new Date();
    license.resumedBy = req.user._id;
    license.resumeReason = reason;

    await license.save();

    // Emit SSE event for license resume
    try {
      const { emitToUser } = require('../utils/socketManager');
      await emitToUser(license.userId.toString(), 'licenseResumed', {
        type: 'licenseResumed',
        data: {
          licenseId: license._id,
          purchaseId: license.purchaseId,
          status: license.status,
          reason: reason,
          resumedAt: license.resumedAt
        },
        timestamp: new Date().toISOString()
      });
    } catch (sseError) {
      console.warn('Failed to emit license resume SSE event:', {
        licenseId: license._id,
        userId: license.userId,
        error: sseError.message
      });
    }

    res.json({ message: 'License resumed successfully', license });
  } catch (error) {
    console.error('Error resuming license:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Complete a license
 * POST /api/admin/licenses/:id/complete
 */
const completeLicense = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid license ID' });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Reason is required' });
    }

    const license = await License.findById(id);
    if (!license) {
      return res.status(404).json({ error: 'License not found' });
    }

    if (!['ACTIVE', 'PAUSED'].includes(license.status)) {
      return res.status(400).json({ error: 'Only active or paused licenses can be completed' });
    }

    // Update license status
    license.status = 'COMPLETED';
    license.adminNotes = `${license.adminNotes || ''}\n[${new Date().toISOString()}] COMPLETED by admin: ${reason}`.trim();
    license.completedAt = new Date();
    license.completedBy = req.user._id;
    license.completionReason = reason;

    await license.save();

    // Emit SSE event for license completion
    try {
      await realtimeSyncService.sendUserUpdate(license.userId, {
        type: 'licenseCompleted',
        data: {
          licenseId: license._id,
          purchaseId: license.purchaseId,
          status: license.status,
          reason: reason,
          completedAt: license.completedAt
        },
        timestamp: new Date().toISOString()
      });
    } catch (sseError) {
      console.warn('Failed to emit license completion SSE event:', {
        licenseId: license._id,
        userId: license.userId,
        error: sseError.message
      });
    }

    res.json({ message: 'License completed successfully', license });
  } catch (error) {
    console.error('Error completing license:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update license cap percentage
 * PATCH /api/admin/licenses/:id/cap
 */
const updateLicenseCap = async (req, res) => {
  try {
    const { id } = req.params;
    const { capPercentMax } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid license ID' });
    }

    if (!capPercentMax || capPercentMax < 0 || capPercentMax > 1000) {
      return res.status(400).json({ error: 'Cap percentage must be between 0 and 1000' });
    }

    const license = await License.findById(id);
    if (!license) {
      return res.status(404).json({ error: 'License not found' });
    }

    const oldCap = license.capPercentMax || 100;
    
    // Update license cap
    license.capPercentMax = capPercentMax;
    license.adminNotes = `${license.adminNotes || ''}\n[${new Date().toISOString()}] CAP updated by admin: ${oldCap}% -> ${capPercentMax}%`.trim();
    license.capUpdatedAt = new Date();
    license.capUpdatedBy = req.user._id;

    await license.save();

    res.json({ message: 'License cap updated successfully', license });
  } catch (error) {
    console.error('Error updating license cap:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getLicenses,
  getLicense,
  pauseLicense,
  resumeLicense,
  completeLicense,
  updateLicenseCap
};