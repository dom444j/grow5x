const CohortService = require('./cohortService');
const User = require('../models/User');
const Ledger = require('../models/Ledger');
const logger = require('../config/logger');

/**
 * Servicio de Referidos - Integración con cohortes
 */

class ReferralService {
  /**
   * Obtener configuración de referidos para un usuario basada en su cohorte
   * @param {string} userId - ID del usuario
   * @returns {Object} Configuración de referidos
   */
  static async getReferralConfigForUser(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('Usuario no encontrado');
      }
      
      // Obtener configuración de la cohorte si existe
      let cohortConfig = null;
      if (user.cohort) {
        cohortConfig = await CohortService.getReferralConfig(user.cohort);
      }
      
      // Configuración por defecto si no hay cohorte o configuración específica
      const defaultConfig = {
        directLevel1Percentage: 10,
        specialParentCodePercentage: 10,
        specialParentCodeDelayDays: 17
      };
      
      return cohortConfig || defaultConfig;
      
    } catch (error) {
      logger.error('Error getting referral config for user:', {
        userId,
        error: error.message,
        stack: error.stack
      });
      
      // Retornar configuración por defecto en caso de error
      return {
        directLevel1Percentage: 10,
        specialParentCodePercentage: 10,
        specialParentCodeDelayDays: 17
      };
    }
  }
  
  /**
   * Calcular comisión de referido directo basada en la cohorte
   * @param {Object} purchase - Compra realizada
   * @param {Object} referrer - Usuario referidor
   * @returns {Object} Información de la comisión
   */
  static async calculateDirectReferralCommission(purchase, referrer) {
    try {
      // Obtener configuración de referidos para el referidor
      const config = await this.getReferralConfigForUser(referrer._id);
      
      const commissionRate = config.directLevel1Percentage / 100;
      const commissionAmount = purchase.priceUSDT * commissionRate;
      
      return {
        amount: commissionAmount,
        rate: commissionRate,
        percentage: config.directLevel1Percentage,
        config: config,
        type: 'direct_referral'
      };
      
    } catch (error) {
      logger.error('Error calculating direct referral commission:', {
        purchaseId: purchase._id,
        referrerId: referrer._id,
        error: error.message,
        stack: error.stack
      });
      
      // Retornar comisión por defecto (10%)
      const defaultRate = 0.10;
      return {
        amount: purchase.priceUSDT * defaultRate,
        rate: defaultRate,
        percentage: 10,
        config: { directLevel1Percentage: 10 },
        type: 'direct_referral'
      };
    }
  }
  
  /**
   * Calcular comisión de código especial padre basada en la cohorte
   * @param {Object} purchase - Compra realizada
   * @param {Object} parentReferrer - Usuario padre del referidor
   * @returns {Object} Información de la comisión
   */
  static async calculateParentBonusCommission(purchase, parentReferrer) {
    try {
      // Obtener configuración de referidos para el padre
      const config = await this.getReferralConfigForUser(parentReferrer._id);
      
      const commissionRate = config.specialParentCodePercentage / 100;
      const commissionAmount = purchase.priceUSDT * commissionRate;
      
      return {
        amount: commissionAmount,
        rate: commissionRate,
        percentage: config.specialParentCodePercentage,
        delayDays: config.specialParentCodeDelayDays,
        config: config,
        type: 'parent_bonus'
      };
      
    } catch (error) {
      logger.error('Error calculating parent bonus commission:', {
        purchaseId: purchase._id,
        parentReferrerId: parentReferrer._id,
        error: error.message,
        stack: error.stack
      });
      
      // Retornar comisión por defecto (10%)
      const defaultRate = 0.10;
      return {
        amount: purchase.priceUSDT * defaultRate,
        rate: defaultRate,
        percentage: 10,
        delayDays: 17,
        config: { specialParentCodePercentage: 10, specialParentCodeDelayDays: 17 },
        type: 'parent_bonus'
      };
    }
  }
  
  /**
   * Procesar comisión de referido directo con configuración de cohorte
   * @param {Object} purchase - Compra realizada
   * @returns {Object} Resultado del procesamiento
   */
  static async processDirectReferralCommission(purchase) {
    try {
      const referrerId = purchase.userId.referredBy;
      
      if (!referrerId) {
        return { commissionPaid: false, message: 'No referrer found' };
      }
      
      // Verificar que el referidor existe y está activo
      const referrer = await User.findById(referrerId);
      if (!referrer) {
        logger.warn(`Referrer ${referrerId} not found for purchase ${purchase._id}`);
        return { commissionPaid: false, message: 'Referrer not found' };
      }
      
      if (referrer.status !== 'active') {
        logger.warn(`Referrer ${referrerId} is not active for purchase ${purchase._id}`);
        return { commissionPaid: false, message: 'Referrer not active' };
      }
      
      // Calcular comisión basada en la cohorte
      const commissionInfo = await this.calculateDirectReferralCommission(purchase, referrer);
      
      // Crear entrada en el ledger
      const ledgerEntry = await Ledger.createReferralCommission({
        userId: referrerId,
        amount: commissionInfo.amount,
        purchaseId: purchase._id,
        referralUserId: purchase.userId._id,
        level: 1,
        description: `Direct referral commission (${commissionInfo.percentage}%) from ${purchase.userId.username || purchase.userId.email}`
      });
      
      logger.info('Direct referral commission processed:', {
        purchaseId: purchase._id,
        referrerId: referrerId,
        amount: commissionInfo.amount,
        percentage: commissionInfo.percentage,
        cohort: referrer.cohort,
        ledgerEntryId: ledgerEntry._id
      });
      
      return {
        commissionPaid: true,
        amount: commissionInfo.amount,
        percentage: commissionInfo.percentage,
        referrerId: referrerId,
        ledgerEntryId: ledgerEntry._id,
        config: commissionInfo.config
      };
      
    } catch (error) {
      logger.error('Error processing direct referral commission:', {
        purchaseId: purchase._id,
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Procesar comisión de código especial padre con configuración de cohorte
   * @param {Object} purchase - Compra realizada
   * @param {Object} directReferrer - Referidor directo
   * @returns {Object} Resultado del procesamiento
   */
  static async processParentBonusCommission(purchase, directReferrer) {
    try {
      if (!directReferrer.referredBy) {
        return { commissionPaid: false, message: 'Direct referrer has no parent' };
      }
      
      // Verificar que es la primera compra del referidor directo
      const referrerPurchases = await require('../models/Purchase').countDocuments({
        user: directReferrer._id,
        status: 'confirmed'
      });
      
      if (referrerPurchases > 0) {
        return { commissionPaid: false, message: 'Not first purchase of direct referrer' };
      }
      
      // Obtener el padre del referidor
      const parentReferrer = await User.findById(directReferrer.referredBy);
      if (!parentReferrer || parentReferrer.status !== 'active') {
        return { commissionPaid: false, message: 'Parent referrer not found or inactive' };
      }
      
      // Calcular comisión basada en la cohorte del padre
      const commissionInfo = await this.calculateParentBonusCommission(purchase, parentReferrer);
      
      // Calcular fecha de liberación (D + delayDays)
      const releaseDate = new Date(purchase.confirmedAt);
      releaseDate.setDate(releaseDate.getDate() + commissionInfo.delayDays);
      
      // Crear entrada en el ledger con fecha de liberación
      const ledgerEntry = await Ledger.createReferralCommission({
        userId: parentReferrer._id,
        amount: commissionInfo.amount,
        purchaseId: purchase._id,
        referralUserId: purchase.userId._id,
        level: 2,
        description: `Parent bonus commission (${commissionInfo.percentage}%) from ${purchase.userId.username || purchase.userId.email} - Release on D+${commissionInfo.delayDays}`,
        scheduledReleaseDate: releaseDate
      });
      
      logger.info('Parent bonus commission processed:', {
        purchaseId: purchase._id,
        parentReferrerId: parentReferrer._id,
        amount: commissionInfo.amount,
        percentage: commissionInfo.percentage,
        delayDays: commissionInfo.delayDays,
        releaseDate: releaseDate,
        cohort: parentReferrer.cohort,
        ledgerEntryId: ledgerEntry._id
      });
      
      return {
        commissionPaid: true,
        amount: commissionInfo.amount,
        percentage: commissionInfo.percentage,
        delayDays: commissionInfo.delayDays,
        releaseDate: releaseDate,
        parentReferrerId: parentReferrer._id,
        ledgerEntryId: ledgerEntry._id,
        config: commissionInfo.config
      };
      
    } catch (error) {
      logger.error('Error processing parent bonus commission:', {
        purchaseId: purchase._id,
        directReferrerId: directReferrer._id,
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Procesar toda la cadena de referidos para una compra
   * @param {Object} purchase - Compra realizada
   * @returns {Object} Resultado del procesamiento completo
   */
  static async processReferralChain(purchase) {
    try {
      const results = {
        directReferral: null,
        parentBonus: null,
        totalCommissions: 0,
        errors: []
      };
      
      // 1. Procesar comisión de referido directo
      try {
        const directResult = await this.processDirectReferralCommission(purchase);
        results.directReferral = directResult;
        
        if (directResult.commissionPaid) {
          results.totalCommissions += directResult.amount;
          
          // 2. Procesar comisión de código especial padre si aplica
          const directReferrer = await User.findById(purchase.userId.referredBy);
          if (directReferrer) {
            try {
              const parentResult = await this.processParentBonusCommission(purchase, directReferrer);
              results.parentBonus = parentResult;
              
              if (parentResult.commissionPaid) {
                results.totalCommissions += parentResult.amount;
              }
            } catch (parentError) {
              results.errors.push({
                type: 'parent_bonus',
                error: parentError.message
              });
            }
          }
        }
      } catch (directError) {
        results.errors.push({
          type: 'direct_referral',
          error: directError.message
        });
      }
      
      logger.info('Referral chain processing completed:', {
        purchaseId: purchase._id,
        totalCommissions: results.totalCommissions,
        directPaid: results.directReferral?.commissionPaid || false,
        parentPaid: results.parentBonus?.commissionPaid || false,
        errorCount: results.errors.length
      });
      
      return results;
      
    } catch (error) {
      logger.error('Error processing referral chain:', {
        purchaseId: purchase._id,
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Obtener estadísticas de referidos por cohorte
   * @param {string} batchId - ID de la cohorte
   * @param {Object} options - Opciones de filtrado
   * @returns {Object} Estadísticas de referidos
   */
  static async getCohortReferralStats(batchId, options = {}) {
    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 días atrás
        endDate = new Date()
      } = options;
      
      // Obtener usuarios de la cohorte
      const cohortUsers = await User.find({ cohort: batchId, isActive: true });
      const userIds = cohortUsers.map(user => user._id);
      
      if (userIds.length === 0) {
        return {
          cohort: batchId,
          totalUsers: 0,
          referralStats: {
            directCommissions: { count: 0, totalAmount: 0 },
            parentBonuses: { count: 0, totalAmount: 0 },
            totalCommissions: { count: 0, totalAmount: 0 }
          }
        };
      }
      
      // Obtener estadísticas de comisiones
      const [directStats, parentStats] = await Promise.all([
        // Comisiones directas
        Ledger.aggregate([
          {
            $match: {
              userId: { $in: userIds },
              type: 'REFERRAL_DIRECT',
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalAmount: { $sum: '$amount' }
            }
          }
        ]),
        
        // Bonos de padre
        Ledger.aggregate([
          {
            $match: {
              userId: { $in: userIds },
              type: 'REFERRAL_INDIRECT',
              'references.referralLevel': 2,
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalAmount: { $sum: '$amount' }
            }
          }
        ])
      ]);
      
      const directData = directStats[0] || { count: 0, totalAmount: 0 };
      const parentData = parentStats[0] || { count: 0, totalAmount: 0 };
      
      return {
        cohort: batchId,
        totalUsers: cohortUsers.length,
        period: { startDate, endDate },
        referralStats: {
          directCommissions: directData,
          parentBonuses: parentData,
          totalCommissions: {
            count: directData.count + parentData.count,
            totalAmount: directData.totalAmount + parentData.totalAmount
          }
        }
      };
      
    } catch (error) {
      logger.error('Error getting cohort referral stats:', {
        batchId,
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
}

module.exports = ReferralService;