const Commission = require('../models/Commission');
const User = require('../models/User');
const logger = require('../config/logger');
const { emitToUser } = require('../utils/socketManager');
const { invalidateCachePattern } = require('../middleware/redisCache');

/**
 * Worker para procesar comisiones D+18
 * Se ejecuta para desbloquear comisiones que han alcanzado su fecha de unlock
 */
class CommissionUnlockWorker {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.processingQueue = new Set();
  }

  /**
   * Inicia el worker
   */
  start(intervalMs = 60000) { // 1 minuto
    if (this.isRunning) {
      logger.warn('Commission unlock worker is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting commission unlock worker', { intervalMs });

    // Procesar inmediatamente
    this.processUnlockableCommissions();

    // Configurar intervalo
    this.intervalId = setInterval(() => {
      this.processUnlockableCommissions();
    }, intervalMs);
  }

  /**
   * Detiene el worker
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    logger.info('Commission unlock worker stopped');
  }

  /**
   * Procesa todas las comisiones listas para desbloquear
   */
  async processUnlockableCommissions() {
    try {
      // Buscar comisiones pending que han alcanzado su unlockDate
      const unlockableCommissions = await Commission.find({
        status: 'pending',
        unlockDate: { $lte: new Date() }
      })
      .populate('recipientUserId', 'email firstName lastName')
      .populate('sourceUserId', 'email firstName lastName')
      .populate('purchaseId', 'purchaseId totalAmount')
      .populate('packageId', 'name')
      .sort({ unlockDate: 1 })
      .limit(50); // Procesar máximo 50 por vez

      if (unlockableCommissions.length === 0) {
        return;
      }

      logger.info(`Processing ${unlockableCommissions.length} unlockable commissions`);

      for (const commission of unlockableCommissions) {
        await this.processSingleCommission(commission);
      }

    } catch (error) {
      logger.error('Error processing unlockable commissions:', error);
    }
  }

  /**
   * Procesa una comisión individual
   */
  async processSingleCommission(commission) {
    const commissionId = commission._id.toString();

    // Evitar procesamiento duplicado
    if (this.processingQueue.has(commissionId)) {
      return;
    }

    this.processingQueue.add(commissionId);

    try {
      logger.info('Processing unlockable commission', {
        commissionId: commission.commissionId,
        recipientUserId: commission.recipientUserId?._id,
        sourceUserId: commission.sourceUserId?._id,
        amount: commission.commissionAmount,
        unlockDate: commission.unlockDate
      });

      // Desbloquear la comisión
      await commission.unlock();

      // Emitir evento SSE al usuario
      await this.emitCommissionEarnedEvent(commission);

      logger.info('Commission unlocked successfully', {
        commissionId: commission.commissionId,
        recipientUserId: commission.recipientUserId?._id,
        amount: commission.commissionAmount
      });

    } catch (error) {
      logger.error('Error processing commission unlock:', {
        commissionId: commission.commissionId,
        error: error.message,
        stack: error.stack
      });

    } finally {
      this.processingQueue.delete(commissionId);
    }
  }

  /**
   * Emite evento SSE de comisión ganada
   */
  async emitCommissionEarnedEvent(commission) {
    try {
      const eventData = {
        type: 'commissionEarned',
        data: {
          commissionId: commission.commissionId,
          amount: commission.commissionAmount,
          currency: commission.currency,
          type: commission.type,
          sourceUser: {
            email: commission.sourceUserId?.email,
            firstName: commission.sourceUserId?.firstName,
            lastName: commission.sourceUserId?.lastName
          },
          purchase: {
            purchaseId: commission.purchaseId?.purchaseId,
            amount: commission.purchaseId?.totalAmount
          },
          package: {
            name: commission.packageId?.name
          },
          unlockedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      // Invalidate user cache patterns
      if (commission.recipientUserId?._id) {
        try {
          const userId = commission.recipientUserId._id.toString();
          await invalidateCachePattern(`user:${userId}:*`);
          await invalidateCachePattern(`dashboard:${userId}:*`);
          await invalidateCachePattern(`me:${userId}:*`);
          await invalidateCachePattern(`balances:${userId}:*`);
          await invalidateCachePattern(`commissions:${userId}:*`);
          
          logger.debug('Cache invalidated for commission earned', {
            userId: userId,
            commissionId: commission.commissionId
          });
        } catch (cacheError) {
          logger.warn('Failed to invalidate cache for commission earned', {
            userId: commission.recipientUserId._id.toString(),
            error: cacheError.message
          });
        }
      }
      
      // Emitir al usuario que recibe la comisión
      if (commission.recipientUserId?._id) {
        await emitToUser(commission.recipientUserId._id.toString(), 'commissionEarned', eventData);
      }

      logger.debug('Commission earned event emitted', {
        commissionId: commission.commissionId,
        recipientUserId: commission.recipientUserId?._id
      });

    } catch (error) {
      logger.error('Error emitting commission earned event:', {
        commissionId: commission.commissionId,
        error: error.message
      });
    }
  }

  /**
   * Obtiene estadísticas del worker
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      processingQueueSize: this.processingQueue.size,
      intervalId: this.intervalId !== null
    };
  }
}

module.exports = new CommissionUnlockWorker();