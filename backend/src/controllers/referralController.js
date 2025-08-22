const User = require('../models/User');
const Ledger = require('../models/Ledger');
const Commission = require('../models/Commission');
const logger = require('../config/logger');

/**
 * Controlador para manejar operaciones de referidos
 */
class ReferralController {
  /**
   * Obtener datos de referidos para administrador
   */
  static async getAdminReferrals(req, res) {
    try {
      const { page = 1, limit = 20, search = '', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
      
      // Construir filtro de búsqueda
      const searchFilter = search ? {
        $or: [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { referralCode: { $regex: search, $options: 'i' } }
        ]
      } : {};
      
      // Calcular paginación
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sortDirection = sortOrder === 'desc' ? -1 : 1;
      
      // Obtener usuarios con referidos
      const users = await User.find(searchFilter)
        .populate('referredBy', 'firstName lastName email referralCode')
        .sort({ [sortBy]: sortDirection })
        .skip(skip)
        .limit(parseInt(limit))
        .select('firstName lastName email referralCode referredBy createdAt isActive');
      
      // Obtener total de usuarios
      const totalUsers = await User.countDocuments(searchFilter);
      
      // Obtener estadísticas de referidos para cada usuario
      const usersWithStats = await Promise.all(users.map(async (user) => {
        const referralCount = await User.countDocuments({ referredBy: user._id });
        
        const commissions = await Ledger.aggregate([
          {
            $match: {
              userId: user._id,
              type: { $in: ['REFERRAL_DIRECT', 'REFERRAL_INDIRECT'] }
            }
          },
          {
            $group: {
              _id: null,
              totalCommissions: { $sum: '$amount' },
              count: { $sum: 1 }
            }
          }
        ]);
        
        const totalCommissions = commissions.length > 0 ? commissions[0].totalCommissions : 0;
        
        return {
          _id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          referralCode: user.referralCode,
          referredBy: user.referredBy ? {
            _id: user.referredBy._id,
            name: `${user.referredBy.firstName} ${user.referredBy.lastName}`,
            email: user.referredBy.email,
            referralCode: user.referredBy.referralCode
          } : null,
          createdAt: user.createdAt,
          isActive: user.isActive,
          stats: {
            totalReferrals: referralCount,
            totalCommissions: Math.round(totalCommissions * 100) / 100
          }
        };
      }));
      
      // Estadísticas generales
      const totalReferrals = await User.countDocuments({ referredBy: { $ne: null } });
      const activeReferrals = await User.countDocuments({ referredBy: { $ne: null }, isActive: true });
      
      const totalCommissionsResult = await Ledger.aggregate([
        {
          $match: {
            type: { $in: ['REFERRAL_DIRECT', 'REFERRAL_INDIRECT'] }
          }
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]);
      
      const totalCommissions = totalCommissionsResult.length > 0 ? totalCommissionsResult[0].totalAmount : 0;
      
      res.json({
        success: true,
        data: {
          users: usersWithStats,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalUsers,
            pages: Math.ceil(totalUsers / parseInt(limit))
          },
          stats: {
            totalUsers,
            totalReferrals,
            activeReferrals,
            totalCommissions: Math.round(totalCommissions * 100) / 100,
            conversionRate: totalReferrals > 0 ? (activeReferrals / totalReferrals) * 100 : 0
          }
        }
      });
      
    } catch (error) {
      logger.error('Error fetching admin referrals:', {
        error: error.message,
        userId: req.user?.userId,
        ip: req.ip
      });
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
  
  /**
   * Obtener estadísticas de referidos para administrador
   */
  static async getAdminReferralStats(req, res) {
    try {
      // Estadísticas básicas
      const totalUsers = await User.countDocuments();
      const totalReferrals = await User.countDocuments({ referredBy: { $ne: null } });
      const activeReferrals = await User.countDocuments({ referredBy: { $ne: null }, isActive: true });
      
      // Comisiones totales
      const commissionsResult = await Ledger.aggregate([
        {
          $match: {
            type: { $in: ['REFERRAL_DIRECT', 'REFERRAL_INDIRECT'] }
          }
        },
        {
          $group: {
            _id: '$type',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]);
      
      const directCommissions = commissionsResult.find(c => c._id === 'REFERRAL_DIRECT') || { totalAmount: 0, count: 0 };
      const indirectCommissions = commissionsResult.find(c => c._id === 'REFERRAL_INDIRECT') || { totalAmount: 0, count: 0 };
      const totalCommissions = directCommissions.totalAmount + indirectCommissions.totalAmount;
      
      // Referidores activos (usuarios que han referido al menos a alguien)
      const activeReferrers = await User.aggregate([
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: 'referredBy',
            as: 'referrals'
          }
        },
        {
          $match: {
            'referrals.0': { $exists: true }
          }
        },
        {
          $count: 'activeReferrers'
        }
      ]);
      
      const activeReferrersCount = activeReferrers.length > 0 ? activeReferrers[0].activeReferrers : 0;
      
      // Top referidores
      const topReferrers = await User.aggregate([
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: 'referredBy',
            as: 'referrals'
          }
        },
        {
          $match: {
            'referrals.0': { $exists: true }
          }
        },
        {
          $addFields: {
            referralCount: { $size: '$referrals' }
          }
        },
        {
          $sort: { referralCount: -1 }
        },
        {
          $limit: 10
        },
        {
          $project: {
            name: { $concat: ['$firstName', ' ', '$lastName'] },
            email: 1,
            referralCode: 1,
            referralCount: 1
          }
        }
      ]);
      
      // Estadísticas mensuales (últimos 6 meses)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const monthlyStats = await User.aggregate([
        {
          $match: {
            referredBy: { $ne: null },
            createdAt: { $gte: sixMonthsAgo }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            newReferrals: { $sum: 1 }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 }
        },
        {
          $project: {
            month: {
              $concat: [
                { $toString: '$_id.year' },
                '-',
                { $cond: [
                  { $lt: ['$_id.month', 10] },
                  { $concat: ['0', { $toString: '$_id.month' }] },
                  { $toString: '$_id.month' }
                ]}
              ]
            },
            newReferrals: 1
          }
        }
      ]);
      
      res.json({
        success: true,
        stats: {
          totalUsers,
          totalReferrals,
          activeReferrals,
          activeReferrers: activeReferrersCount,
          conversionRate: totalReferrals > 0 ? (activeReferrals / totalReferrals) * 100 : 0,
          commissions: {
            direct: {
              amount: Math.round(directCommissions.totalAmount * 100) / 100,
              count: directCommissions.count
            },
            indirect: {
              amount: Math.round(indirectCommissions.totalAmount * 100) / 100,
              count: indirectCommissions.count
            },
            total: {
              amount: Math.round(totalCommissions * 100) / 100,
              count: directCommissions.count + indirectCommissions.count
            }
          },
          topReferrers,
          monthlyStats,
          averageCommissionPerReferral: totalReferrals > 0 ? Math.round((totalCommissions / totalReferrals) * 100) / 100 : 0
        }
      });
      
    } catch (error) {
      logger.error('Error fetching admin referral stats:', {
        error: error.message,
        userId: req.user?.userId,
        ip: req.ip
      });
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
  
  /**
   * Obtener datos de referidos para usuario
   */
  static async getUserReferrals(req, res) {
    try {
      const userId = req.user.userId;
      const { page = 1, limit = 20 } = req.query;
      
      // Obtener datos del usuario
      const user = await User.findOne({ userId: userId })
        .populate('referredBy', 'firstName lastName email referralCode')
        .select('firstName lastName email referralCode referredBy referralStats');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }
      
      // Calcular paginación
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      // Obtener usuarios referidos por este usuario
      const referredUsers = await User.find({ referredBy: user._id })
        .select('firstName lastName email createdAt isActive')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
      
      // Obtener total de referidos
      const totalReferrals = await User.countDocuments({ referredBy: user._id });
      
      // Obtener comisiones del usuario
      const commissions = await Ledger.aggregate([
        {
          $match: {
            userId: user._id,
            type: { $in: ['REFERRAL_DIRECT', 'REFERRAL_INDIRECT'] }
          }
        },
        {
          $group: {
            _id: '$type',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]);
      
      // Formatear datos de comisiones
      const directCommissions = commissions.find(c => c._id === 'REFERRAL_DIRECT') || { totalAmount: 0, count: 0 };
      const indirectCommissions = commissions.find(c => c._id === 'REFERRAL_INDIRECT') || { totalAmount: 0, count: 0 };
      const totalCommissions = directCommissions.totalAmount + indirectCommissions.totalAmount;
      
      // Obtener historial reciente de comisiones
      const recentCommissions = await Ledger.find({
        userId: user._id,
        type: { $in: ['REFERRAL_DIRECT', 'REFERRAL_INDIRECT'] }
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('amount type description createdAt');
      
      res.json({
        success: true,
        data: {
          user: {
            _id: user._id,
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            referralCode: user.referralCode,
            referredBy: user.referredBy ? {
              _id: user.referredBy._id,
              name: `${user.referredBy.firstName} ${user.referredBy.lastName}`,
              email: user.referredBy.email,
              referralCode: user.referredBy.referralCode
            } : null
          },
          referrals: {
            users: referredUsers.map(ref => ({
              _id: ref._id,
              name: `${ref.firstName} ${ref.lastName}`,
              email: ref.email,
              createdAt: ref.createdAt,
              isActive: ref.isActive
            })),
            totalCount: totalReferrals,
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total: totalReferrals,
              pages: Math.ceil(totalReferrals / parseInt(limit))
            }
          },
          commissions: {
            direct: {
              amount: Math.round(directCommissions.totalAmount * 100) / 100,
              count: directCommissions.count
            },
            indirect: {
              amount: Math.round(indirectCommissions.totalAmount * 100) / 100,
              count: indirectCommissions.count
            },
            total: {
              amount: Math.round(totalCommissions * 100) / 100,
              count: directCommissions.count + indirectCommissions.count
            },
            recent: recentCommissions.map(comm => ({
              _id: comm._id,
              amount: Math.round(comm.amount * 100) / 100,
              type: comm.type,
              description: comm.description,
              createdAt: comm.createdAt
            }))
          },
          stats: {
            totalReferrals: user.referralStats?.totalReferrals || 0,
            totalCommissions: Math.round(totalCommissions * 100) / 100
          }
        }
      });
      
    } catch (error) {
      logger.error('Error fetching user referrals:', {
        error: error.message,
        userId: req.user?.userId,
        ip: req.ip
      });
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
  
  /**
   * Obtener estadísticas de referidos para usuario
   */
  static async getUserReferralStats(req, res) {
    try {
      const userId = req.user.userId;
      
      // Obtener datos del usuario
      const user = await User.findOne({ userId: userId })
        .select('referralCode referralStats');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }
      
      // Obtener total de referidos
      const totalReferrals = await User.countDocuments({ referredBy: user._id });
      
      // Obtener referidos activos
      const activeReferrals = await User.countDocuments({ 
        referredBy: user._id, 
        isActive: true 
      });
      
      // Obtener comisiones totales
      const commissionsResult = await Ledger.aggregate([
        {
          $match: {
            userId: user._id, // Fix: use ObjectId instead of string
            type: { $in: ['REFERRAL_DIRECT', 'REFERRAL_INDIRECT'] }
          }
        },
        {
          $group: {
            _id: '$type',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]);
      
      // Formatear datos de comisiones
      const directCommissions = commissionsResult.find(c => c._id === 'REFERRAL_DIRECT') || { totalAmount: 0, count: 0 };
      const indirectCommissions = commissionsResult.find(c => c._id === 'REFERRAL_INDIRECT') || { totalAmount: 0, count: 0 };
      const totalCommissions = directCommissions.totalAmount + indirectCommissions.totalAmount;
      
      // Obtener estadísticas mensuales de los últimos 6 meses
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const monthlyStats = await User.aggregate([
        {
          $match: {
            referredBy: user._id,
            createdAt: { $gte: sixMonthsAgo }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            newReferrals: { $sum: 1 }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 }
        },
        {
          $project: {
            month: {
              $concat: [
                { $toString: '$_id.year' },
                '-',
                { $cond: [
                  { $lt: ['$_id.month', 10] },
                  { $concat: ['0', { $toString: '$_id.month' }] },
                  { $toString: '$_id.month' }
                ]}
              ]
            },
            newReferrals: 1
          }
        }
      ]);
      
      // Obtener ganancias por comisiones por mes
      const monthlyCommissions = await Ledger.aggregate([
        {
          $match: {
            userId: user._id, // Fix: use ObjectId instead of string
            type: { $in: ['REFERRAL_DIRECT', 'REFERRAL_INDIRECT'] },
            createdAt: { $gte: sixMonthsAgo }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            totalEarnings: { $sum: '$amount' }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 }
        },
        {
          $project: {
            month: {
              $concat: [
                { $toString: '$_id.year' },
                '-',
                { $cond: [
                  { $lt: ['$_id.month', 10] },
                  { $concat: ['0', { $toString: '$_id.month' }] },
                  { $toString: '$_id.month' }
                ]}
              ]
            },
            totalEarnings: { $round: ['$totalEarnings', 2] }
          }
        }
      ]);
      
      // Construct referral link using PUBLIC_APP_URL
      const publicAppUrl = process.env.PUBLIC_APP_URL || 'http://localhost:3000';
      const referralLink = `${publicAppUrl}/r/${user.referralCode}`;
      
      res.json({
        success: true,
        totals: {
          total: totalReferrals,
          active: activeReferrals,
          thisMonth: monthlyStats.length > 0 ? monthlyStats[monthlyStats.length - 1].totalReferrals : 0
        },
        commissions: {
          earnedUSDT: Math.round(totalCommissions * 100) / 100
        },
        referral: {
          code: user.referralCode,
          link: referralLink
        },
        stats: {
          referralCode: user.referralCode,
          totalReferrals,
          activeReferrals,
          conversionRate: totalReferrals > 0 ? (activeReferrals / totalReferrals) * 100 : 0,
          commissions: {
            direct: {
              amount: Math.round(directCommissions.totalAmount * 100) / 100,
              count: directCommissions.count
            },
            indirect: {
              amount: Math.round(indirectCommissions.totalAmount * 100) / 100,
              count: indirectCommissions.count
            },
            total: {
              amount: Math.round(totalCommissions * 100) / 100,
              count: directCommissions.count + indirectCommissions.count
            }
          },
          monthlyStats,
          monthlyCommissions,
          averageCommissionPerReferral: totalReferrals > 0 ? Math.round((totalCommissions / totalReferrals) * 100) / 100 : 0
        }
      });
      
    } catch (error) {
      logger.error('Error fetching user referral stats:', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.userId,
        ip: req.ip
      });
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        debug: error.message
      });
    }
  }
}

module.exports = ReferralController;