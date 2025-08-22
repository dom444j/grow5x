const Purchase = require('../models/Purchase');
const Ledger = require('../models/Ledger');
const BenefitLedger = require('../models/BenefitLedger');
const Commission = require('../models/Commission');
const Withdrawal = require('../models/Withdrawal');
const Wallet = require('../models/Wallet');
const DecimalCalc = require('../utils/decimal');
const logger = require('../config/logger');

/**
 * Servicio centralizado para métricas y agregaciones del dashboard admin
 */
class MetricsService {
  /**
   * Obtener métricas de ventas
   * @param {Date} startDate - Fecha de inicio
   * @param {Date} endDate - Fecha de fin (opcional)
   * @returns {Object} Métricas de ventas
   */
  static async getSalesMetrics(startDate, endDate = null) {
    try {
      const matchCondition = {
        status: 'confirmed',
        createdAt: { $gte: startDate }
      };
      
      if (endDate) {
        matchCondition.createdAt.$lt = endDate;
      }
      
      const result = await Purchase.aggregate([
        { $match: matchCondition },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            amount: { $sum: '$totalAmount' }
          }
        }
      ]);
      
      return {
        count: result[0]?.count || 0,
        amountUSDT: DecimalCalc.round((result[0]?.amount || 0), 2)
      };
    } catch (error) {
      logger.error('Error getting sales metrics:', error);
      return { count: 0, amountUSDT: 0 };
    }
  }
  
  /**
   * Obtener métricas de referidos
   * @param {Date} startDate - Fecha de inicio
   * @returns {Object} Métricas de referidos
   */
  static async getReferralMetrics(startDate) {
    try {
      const [directReferrals, parentGlobalQueued, parentGlobalReleased] = await Promise.all([
        // Referidos directos en el período
        Ledger.aggregate([
          {
            $match: {
              type: 'REFERRAL_DIRECT',
              status: 'confirmed',
              transactionDate: { $gte: startDate }
            }
          },
          {
            $group: {
              _id: null,
              amount: { $sum: '$amount' }
            }
          }
        ]),
        // Comisiones padre pendientes globalmente
        Ledger.aggregate([
          {
            $match: {
              type: 'REFERRAL_GLOBAL_PARENT',
              status: 'pending'
            }
          },
          {
            $group: {
              _id: null,
              amount: { $sum: '$amount' }
            }
          }
        ]),
        // Comisiones padre liberadas en el período
        Ledger.aggregate([
          {
            $match: {
              type: 'REFERRAL_GLOBAL_PARENT',
              status: 'confirmed',
              transactionDate: { $gte: startDate }
            }
          },
          {
            $group: {
              _id: null,
              amount: { $sum: '$amount' }
            }
          }
        ])
      ]);
      
      return {
        directUSDT: DecimalCalc.round((directReferrals[0]?.amount || 0), 2),
        parentGlobalQueuedUSDT: DecimalCalc.round((parentGlobalQueued[0]?.amount || 0), 2),
        parentGlobalReleasedUSDT: DecimalCalc.round((parentGlobalReleased[0]?.amount || 0), 2)
      };
    } catch (error) {
      logger.error('Error getting referral metrics:', error);
      return { directUSDT: 0, parentGlobalQueuedUSDT: 0, parentGlobalReleasedUSDT: 0 };
    }
  }
  
  /**
   * Obtener métricas de beneficios usando BenefitLedger
   * @param {Date} startDate - Fecha de inicio del día
   * @param {Date} endDate - Fecha de fin del día
   * @returns {Object} Métricas de beneficios
   */
  static async getBenefitsMetrics(startDate, endDate) {
    try {
      const [benefitsToday, benefitsPending, benefitsPaid] = await Promise.all([
        // Beneficios del día usando BenefitLedger
        BenefitLedger.aggregate([
          {
            $match: {
              type: 'DAILY_BENEFIT',
              status: 'paid',
              paidAt: { $gte: startDate, $lt: endDate }
            }
          },
          {
            $group: {
              _id: null,
              amount: { $sum: '$amount' }
            }
          }
        ]),
        // Beneficios pendientes
        BenefitLedger.countDocuments({
          type: 'DAILY_BENEFIT',
          status: 'scheduled'
        }),
        // Beneficios pagados
        BenefitLedger.countDocuments({
          type: 'DAILY_BENEFIT',
          status: 'paid'
        })
      ]);
      
      return {
        todayUSDT: DecimalCalc.round((benefitsToday[0]?.amount || 0), 2),
        pendingCount: benefitsPending,
        paidCount: benefitsPaid
      };
    } catch (error) {
      logger.error('Error getting benefits metrics:', error);
      return { todayUSDT: 0, pendingCount: 0, paidCount: 0 };
    }
  }
  
  /**
   * Obtener métricas de comisiones
   * @returns {Object} Métricas de comisiones
   */
  static async getCommissionMetrics() {
    try {
      const d17QueueCount = await Commission.countDocuments({
        status: 'pending',
        unlockDate: { $lte: new Date() }
      });
      
      return {
        d17QueueCount
      };
    } catch (error) {
      logger.error('Error getting commission metrics:', error);
      return { d17QueueCount: 0 };
    }
  }
  
  /**
   * Obtener métricas de retiros
   * @param {Date} startDate - Fecha de inicio para retiros completados
   * @param {Date} slaStartDate - Fecha de inicio para cálculo de SLA (7 días)
   * @returns {Object} Métricas de retiros
   */
  static async getWithdrawalMetrics(startDate, slaStartDate) {
    try {
      const [withdrawalsPending, withdrawalsApproved, withdrawalsCompleted24h, withdrawalsSLA] = await Promise.all([
        // Retiros pendientes
        Withdrawal.countDocuments({ status: 'requested' }),
        // Retiros aprobados
        Withdrawal.countDocuments({ status: 'approved' }),
        // Retiros completados en 24h
        Withdrawal.countDocuments({
          status: 'completed',
          completedAt: { $gte: startDate }
        }),
        // SLA de retiros (7 días)
        Withdrawal.aggregate([
          {
            $match: {
              status: 'completed',
              completedAt: { $gte: slaStartDate },
              requestedAt: { $exists: true },
              completedAt: { $exists: true }
            }
          },
          {
            $project: {
              processingTimeMinutes: {
                $divide: [
                  { $subtract: ['$completedAt', '$requestedAt'] },
                  60000
                ]
              }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              withinSLA: {
                $sum: {
                  $cond: [{ $lte: ['$processingTimeMinutes', 1440] }, 1, 0] // 24h SLA
                }
              }
            }
          }
        ])
      ]);
      
      const slaData = withdrawalsSLA[0];
      const slaHitRate = slaData ? (slaData.withinSLA / slaData.total) : 0;
      
      return {
        pending: withdrawalsPending,
        approved: withdrawalsApproved,
        completed24h: withdrawalsCompleted24h,
        slaHitRate7d: DecimalCalc.round(slaHitRate * 100, 1) // Porcentaje con 1 decimal
      };
    } catch (error) {
      logger.error('Error getting withdrawal metrics:', error);
      return { pending: 0, approved: 0, completed24h: 0, slaHitRate7d: 0 };
    }
  }
  
  /**
   * Obtener métricas del pool de wallets V2
   * @returns {Object} Métricas del pool
   */
  static async getPoolMetrics() {
    try {
      const [poolStats, poolIntervals] = await Promise.all([
        // Estadísticas del pool
        Wallet.aggregate([
          {
            $match: {
              network: 'BEP20',
              currency: 'USDT',
              purpose: 'collection'
            }
          },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ]),
        // Intervalos del pool
        Wallet.aggregate([
          {
            $match: {
              network: 'BEP20',
              currency: 'USDT',
              purpose: 'collection',
              status: 'available',
              lastShownAt: { $exists: true }
            }
          },
          {
            $project: {
              intervalMs: {
                $subtract: [new Date(), '$lastShownAt']
              }
            }
          },
          {
            $group: {
              _id: null,
              intervals: { $push: '$intervalMs' }
            }
          }
        ])
      ]);
      
      // Procesar estadísticas del pool
      const poolCounts = { total: 0, available: 0 };
      poolStats.forEach(stat => {
        poolCounts.total += stat.count;
        if (stat._id === 'available') {
          poolCounts.available = stat.count;
        }
      });
      
      // Calcular intervalos del pool
      let medianIntervalMs = 0;
      let p90IntervalMs = 0;
      if (poolIntervals[0]?.intervals?.length > 0) {
        const intervals = poolIntervals[0].intervals.sort((a, b) => a - b);
        const len = intervals.length;
        medianIntervalMs = intervals[Math.floor(len / 2)];
        p90IntervalMs = intervals[Math.floor(len * 0.9)];
      }
      
      return {
        total: poolCounts.total,
        available: poolCounts.available,
        medianIntervalMs: Math.round(medianIntervalMs),
        p90IntervalMs: Math.round(p90IntervalMs)
      };
    } catch (error) {
      logger.error('Error getting pool metrics:', error);
      return { total: 0, available: 0, medianIntervalMs: 0, p90IntervalMs: 0 };
    }
  }
  
  /**
   * Obtener todas las métricas del dashboard admin
   * @returns {Object} Todas las métricas
   */
  static async getAllMetrics() {
    try {
      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const [sales24h, sales7d, referrals, benefits, commissions, withdrawals, pool] = await Promise.all([
        this.getSalesMetrics(last24h),
        this.getSalesMetrics(last7d),
        this.getReferralMetrics(last24h),
        this.getBenefitsMetrics(today, tomorrow),
        this.getCommissionMetrics(),
        this.getWithdrawalMetrics(last24h, last7d),
        this.getPoolMetrics()
      ]);
      
      return {
        asOf: now.toISOString(),
        sales: {
          count24h: sales24h.count,
          amount24hUSDT: sales24h.amountUSDT,
          count7d: sales7d.count,
          amount7dUSDT: sales7d.amountUSDT
        },
        referrals: {
          direct24hUSDT: referrals.directUSDT,
          parentGlobalQueuedUSDT: referrals.parentGlobalQueuedUSDT,
          parentGlobalReleased24hUSDT: referrals.parentGlobalReleasedUSDT
        },
        benefits,
        commissions,
        withdrawals,
        poolV2: pool
      };
    } catch (error) {
      logger.error('Error getting all metrics:', error);
      throw error;
    }
  }
}

module.exports = MetricsService;