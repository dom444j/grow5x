const Purchase = require('../models/Purchase');
const licenseService = require('../services/licenseService');
const logger = require('../config/logger');
const { emitToUser } = require('../utils/socketManager');
const { invalidateCachePattern } = require('../middleware/redisCache');

/**
 * Worker para procesar confirmaciones de compras
 * Se ejecuta cuando una compra cambia a estado 'completed'
 */
class PurchaseConfirmationWorker {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.processingQueue = new Set();
  }

  /**
   * Inicia el worker
   */
  start(intervalMs = 30000) { // 30 segundos
    if (this.isRunning) {
      logger.warn('Purchase confirmation worker is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting purchase confirmation worker', { intervalMs });

    // Procesar inmediatamente
    this.processConfirmedPurchases();

    // Configurar intervalo
    this.intervalId = setInterval(() => {
      this.processConfirmedPurchases();
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

    logger.info('Purchase confirmation worker stopped');
  }

  /**
   * Procesa todas las compras confirmadas pendientes
   */
  async processConfirmedPurchases() {
    try {
      // Buscar compras activas que no tienen licencia asociada
      const confirmedPurchases = await Purchase.find({
        status: 'ACTIVE',
        licenseCreated: false
      })
      .populate('packageId', 'name price dailyBenefitRate benefitDays totalCycles cashbackRate')
      .populate('userId', 'email firstName lastName')
      .sort({ updatedAt: 1 })
      .limit(10); // Procesar máximo 10 por vez

      if (confirmedPurchases.length === 0) {
        return;
      }

      logger.info(`Processing ${confirmedPurchases.length} confirmed purchases`);

      for (const purchase of confirmedPurchases) {
        await this.processSinglePurchase(purchase);
      }

    } catch (error) {
      logger.error('Error processing confirmed purchases:', error);
    }
  }

  /**
   * Procesa una compra individual
   */
  async processSinglePurchase(purchase) {
    const purchaseId = purchase._id.toString();

    // Evitar procesamiento duplicado
    if (this.processingQueue.has(purchaseId)) {
      return;
    }

    this.processingQueue.add(purchaseId);

    try {
      logger.info('Processing confirmed purchase', {
        purchaseId: purchase.purchaseId,
        userId: purchase.userId,
        packageName: purchase.packageId?.name,
        amount: purchase.totalAmount
      });

      // Crear licencia y eventos de beneficios
      const license = await licenseService.createLicenseFromPurchase(purchase._id);

      // Marcar la compra como procesada
      await Purchase.findByIdAndUpdate(purchase._id, {
        licenseCreated: true,
        licenseId: license._id,
        processedAt: new Date()
      });

      // Emitir evento SSE al usuario
      await this.emitPurchaseConfirmedEvent(purchase, license);

      logger.info('Purchase confirmation processed successfully', {
        purchaseId: purchase.purchaseId,
        licenseId: license.licenseId,
        userId: purchase.userId
      });

    } catch (error) {
      logger.error('Error processing purchase confirmation:', {
        purchaseId: purchase.purchaseId,
        error: error.message,
        stack: error.stack
      });

      // Marcar como error para evitar reprocesamiento inmediato
      await Purchase.findByIdAndUpdate(purchase._id, {
        processingError: error.message,
        lastProcessingAttempt: new Date()
      });

    } finally {
      this.processingQueue.delete(purchaseId);
    }
  }

  /**
   * Emite evento SSE de compra confirmada
   */
  async emitPurchaseConfirmedEvent(purchase, license) {
    try {
      const eventData = {
        type: 'purchaseConfirmed',
        data: {
          purchaseId: purchase.purchaseId,
          licenseId: license.licenseId,
          packageName: purchase.packageId?.name,
          amount: purchase.totalAmount,
          currency: purchase.currency,
          benefitDays: license.benefitDays,
          totalCycles: license.totalCycles,
          dailyBenefitRate: license.dailyBenefitRate,
          nextBenefitDate: license.nextBenefitDate,
          confirmedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      // Invalidate user cache patterns
      try {
        await invalidateCachePattern(`user:${purchase.userId}:*`);
        await invalidateCachePattern(`purchases:${purchase.userId}:*`);
        await invalidateCachePattern(`dashboard:${purchase.userId}:*`);
        await invalidateCachePattern(`me:${purchase.userId}:*`);
        
        logger.debug('Cache invalidated for purchase confirmed', {
          userId: purchase.userId,
          purchaseId: purchase.purchaseId
        });
      } catch (cacheError) {
        logger.warn('Failed to invalidate cache for purchase confirmed', {
          userId: purchase.userId,
          error: cacheError.message
        });
      }
      
      // Emitir al usuario específico
      emitToUser(purchase.userId, 'purchaseConfirmed', eventData);

      logger.info('Purchase confirmed event emitted', {
        userId: purchase.userId,
        purchaseId: purchase.purchaseId,
        licenseId: license.licenseId
      });

    } catch (error) {
      logger.error('Error emitting purchase confirmed event:', error);
    }
  }

  /**
   * Procesa una compra específica por ID (para uso manual)
   */
  async processSpecificPurchase(purchaseId) {
    try {
      const purchase = await Purchase.findById(purchaseId)
        .populate('packageId', 'name price dailyBenefitRate benefitDays totalCycles cashbackRate')
        .populate('userId', 'email firstName lastName');

      if (!purchase) {
        throw new Error('Purchase not found');
      }

      if (purchase.status !== 'completed') {
        throw new Error('Purchase is not in completed status');
      }

      if (purchase.licenseCreated) {
        throw new Error('License already created for this purchase');
      }

      await this.processSinglePurchase(purchase);
      return true;

    } catch (error) {
      logger.error('Error processing specific purchase:', {
        purchaseId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtiene estadísticas del worker
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      queueSize: this.processingQueue.size,
      uptime: this.isRunning ? Date.now() - this.startTime : 0
    };
  }

  /**
   * Reintenta procesar compras con errores
   */
  async retryFailedPurchases() {
    try {
      const failedPurchases = await Purchase.find({
        status: 'completed',
        licenseCreated: { $ne: true },
        processingError: { $exists: true },
        lastProcessingAttempt: {
          $lt: new Date(Date.now() - 60 * 60 * 1000) // 1 hora atrás
        }
      })
      .populate('packageId', 'name price dailyBenefitRate benefitDays totalCycles cashbackRate')
      .populate('userId', 'email firstName lastName')
      .limit(5);

      logger.info(`Retrying ${failedPurchases.length} failed purchases`);

      for (const purchase of failedPurchases) {
        // Limpiar error anterior
        await Purchase.findByIdAndUpdate(purchase._id, {
          $unset: { processingError: 1, lastProcessingAttempt: 1 }
        });

        await this.processSinglePurchase(purchase);
      }

    } catch (error) {
      logger.error('Error retrying failed purchases:', error);
    }
  }
}

// Instancia singleton
const purchaseConfirmationWorker = new PurchaseConfirmationWorker();

module.exports = {
  PurchaseConfirmationWorker,
  purchaseConfirmationWorker
};