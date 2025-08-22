const express = require('express');
const { User, Commission, Purchase } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../config/logger');
const { toApiNumber, DecimalCalc } = require('../utils/decimal');
const dayjs = require('dayjs');

const router = express.Router();

// Middleware to check if user has special parent status
const requireSpecialParent = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user || user.specialParentStatus !== 'special_parent') {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Se requiere estatus de padre especial.'
      });
    }
    
    req.specialParentUser = user;
    next();
  } catch (error) {
    logger.error('Error checking special parent status:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Apply authentication middleware
router.use(authenticateToken, requireSpecialParent);

// Get special parent dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = '30' } = req.query; // days
    
    const startDate = dayjs().subtract(parseInt(period), 'day').toDate();
    
    // Get direct referrals count
    const directReferrals = await User.countDocuments({
      referredBy: userId,
      createdAt: { $gte: startDate }
    });
    
    // Get total commissions earned as special parent
    const totalCommissions = await Commission.aggregate([
      {
        $match: {
          userId: req.user._id,
          createdAt: { $gte: startDate },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get active referrals (users who made purchases)
    const activeReferrals = await Purchase.aggregate([
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
      },
      {
        $match: {
          'user.referredBy': userId,
          status: 'confirmed',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$userId'
        }
      },
      {
        $count: 'activeReferrals'
      }
    ]);
    
    // Get commission breakdown by type
    const commissionBreakdown = await Commission.aggregate([
      {
        $match: {
          userId: req.user._id,
          createdAt: { $gte: startDate },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    const stats = {
      specialParentCode: req.specialParentUser.specialParentCode,
      assignedAt: req.specialParentUser.specialParentAssignedAt,
      period: parseInt(period),
      directReferrals,
      activeReferrals: activeReferrals[0]?.activeReferrals || 0,
      totalCommissions: {
        amount: toApiNumber(totalCommissions[0]?.total || 0),
        count: totalCommissions[0]?.count || 0
      },
      commissionBreakdown: commissionBreakdown.map(item => ({
        type: item._id,
        amount: toApiNumber(item.total),
        count: item.count
      }))
    };
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    logger.error('Error fetching special parent dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Get detailed commission history for special parent
router.get('/commissions', async (req, res) => {
  try {
    const { page = 1, limit = 20, type, startDate, endDate } = req.query;
    const skip = DecimalCalc.multiply(DecimalCalc.subtract(page, 1), limit);
    
    // Build query
    const query = {
      userId: req.user._id
    };
    
    if (type) {
      query.type = type;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const [commissions, total] = await Promise.all([
      Commission.find(query)
        .populate('purchaseId', 'packageId amount')
        .populate({
          path: 'purchaseId',
          populate: {
            path: 'packageId',
            select: 'name'
          }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Commission.countDocuments(query)
    ]);
    
    const formattedCommissions = commissions.map(commission => ({
      id: commission._id,
      type: commission.type,
      amount: toApiNumber(commission.amount),
      percentage: commission.percentage,
      status: commission.status,
      createdAt: commission.createdAt,
      purchase: commission.purchaseId ? {
        id: commission.purchaseId._id,
        amount: toApiNumber(commission.purchaseId.amount),
        package: commission.purchaseId.packageId?.name || 'N/A'
      } : null
    }));
    
    res.json({
      success: true,
      data: formattedCommissions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: DecimalCalc.round(total / limit)
      }
    });
    
  } catch (error) {
    logger.error('Error fetching special parent commissions:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Get referral network for special parent
router.get('/referrals', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', status = 'all' } = req.query;
    const skip = (page - 1) * limit;
    
    // Build query for direct referrals
    const query = {
      referredBy: req.user.id
    };
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status !== 'all') {
      query.isActive = status === 'active';
    }
    
    const [referrals, total] = await Promise.all([
      User.find(query)
        .select('firstName lastName email isActive createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);
    
    // Get purchase stats for each referral
    const referralIds = referrals.map(r => r._id);
    const purchaseStats = await Purchase.aggregate([
      {
        $match: {
          userId: { $in: referralIds },
          status: 'confirmed'
        }
      },
      {
        $group: {
          _id: '$userId',
          totalPurchases: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          lastPurchase: { $max: '$createdAt' }
        }
      }
    ]);
    
    const statsMap = new Map(purchaseStats.map(stat => [stat._id.toString(), stat]));
    
    const formattedReferrals = referrals.map(referral => {
      const stats = statsMap.get(referral._id.toString()) || {
        totalPurchases: 0,
        totalAmount: 0,
        lastPurchase: null
      };
      
      return {
        id: referral._id,
        firstName: referral.firstName,
        lastName: referral.lastName,
        email: referral.email,
        isActive: referral.isActive,
        joinedAt: referral.createdAt,
        stats: {
          totalPurchases: stats.totalPurchases,
          totalAmount: toApiNumber(stats.totalAmount),
          lastPurchase: stats.lastPurchase
        }
      };
    });
    
    res.json({
      success: true,
      data: formattedReferrals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    logger.error('Error fetching special parent referrals:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Get monthly performance report
router.get('/performance', async (req, res) => {
  try {
    const { months = 6 } = req.query;
    const monthsBack = parseInt(months);
    
    const startDate = dayjs().subtract(monthsBack, 'month').startOf('month').toDate();
    
    // Get monthly commission data
    const monthlyCommissions = await Commission.aggregate([
      {
        $match: {
          userId: req.user._id,
          status: 'completed',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            type: '$type'
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);
    
    // Get monthly referral data
    const monthlyReferrals = await User.aggregate([
      {
        $match: {
          referredBy: req.user.id,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);
    
    // Format data by month
    const performanceData = [];
    for (let i = 0; i < monthsBack; i++) {
      const date = dayjs().subtract(i, 'month');
      const year = date.year();
      const month = date.month() + 1;
      
      const commissions = monthlyCommissions.filter(c => 
        c._id.year === year && c._id.month === month
      );
      
      const referrals = monthlyReferrals.find(r => 
        r._id.year === year && r._id.month === month
      );
      
      const commissionsByType = {};
      let totalCommissions = 0;
      
      commissions.forEach(c => {
        commissionsByType[c._id.type] = {
          amount: toApiNumber(c.total),
          count: c.count
        };
        totalCommissions += c.total;
      });
      
      performanceData.unshift({
        period: date.format('YYYY-MM'),
        referrals: referrals?.count || 0,
        totalCommissions: toApiNumber(totalCommissions),
        commissionsByType
      });
    }
    
    res.json({
      success: true,
      data: performanceData
    });
    
  } catch (error) {
    logger.error('Error fetching special parent performance:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

module.exports = router;