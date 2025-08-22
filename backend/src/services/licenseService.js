const License = require('../models/License');
const BenefitLedger = require('../models/BenefitLedger');
const Purchase = require('../models/Purchase');
const Package = require('../models/Package');
const { emitToUser } = require('./realtimeSyncService');
const logger = require('../config/logger');

class LicenseService {
  /**
   * Crear licencia desde una compra confirmada
   * Implementa activación automática con patrón 8+1 días por 5 ciclos
   */
  async createLicenseFromPurchase(purchaseId) {
    try {
      const purchase = await Purchase.findById(purchaseId).populate('packageId');
      if (!purchase) {
        throw new Error('Purchase not found');
      }

      if (purchase.status !== 'ACTIVE') {
        throw new Error('Purchase must be ACTIVE to create license');
      }

      // Verificar si ya existe una licencia para esta compra
      const existingLicense = await License.findOne({ purchaseId });
      if (existingLicense) {
        logger.warn(`License already exists for purchase ${purchaseId}`);
        return existingLicense;
      }

      const packageData = purchase.packageId;
      
      console.log('=== DEBUGGING PACKAGE DATA ===');
      console.log('Purchase:', JSON.stringify(purchase, null, 2));
      console.log('PackageData:', JSON.stringify(packageData, null, 2));
      console.log('=== END DEBUG ===');
      
      if (!packageData) {
        throw new Error('Package data not found or not populated');
      }
      
      // Calcular la próxima fecha de beneficio (mañana a las 9 AM)
      const nextBenefitDate = new Date();
      nextBenefitDate.setDate(nextBenefitDate.getDate() + 1);
      nextBenefitDate.setHours(9, 0, 0, 0);

      // Crear la licencia con configuración 8+1 días por 5 ciclos
      const license = new License({
        userId: purchase.userId,
        purchaseId: purchase._id,
        packageId: packageData._id,
        licenseId: `LIC-${purchase.purchaseId}`,
        principalAmount: purchase.amount || purchase.totalAmount || purchase.amountUSDT,
        currency: purchase.currency || 'USDT',
        status: 'ACTIVE',
        activatedAt: purchase.confirmedAt || new Date(),
        startedAt: purchase.confirmedAt || new Date(),
        
        // Configuración de beneficios: 8+1 días por 5 ciclos
        dailyBenefitRate: 0.125, // 12.5% diario
        benefitDays: 8, // 8 días de producción por ciclo
        totalCycles: 5, // 5 ciclos totales
        
        // Total de días: 5 ciclos × (8 días producción + 1 día pausa) = 45 días
        totalDays: 45,
        
        nextBenefitDate: nextBenefitDate,
        network: purchase.network,
        
        metadata: {
          createdBy: 'licenseService',
          createdAt: new Date(),
          activationPattern: '8+1 days per cycle, 5 cycles total',
          notes: 'License created from confirmed purchase with automatic activation'
        }
      });

      const savedLicense = await license.save();
      
      // Crear BenefitLedger para tracking
      const benefitLedger = new BenefitLedger({
        userId: purchase.userId,
        licenseId: savedLicense._id,
        purchaseId: purchase._id,
        packageId: packageData._id,
        principalAmount: savedLicense.principalAmount,
        currency: savedLicense.currency,
        status: 'active',
        createdAt: new Date(),
        metadata: {
          activationPattern: '8+1×5',
          totalExpectedDays: 40 // 8 días × 5 ciclos
        }
      });

      await benefitLedger.save();
      logger.info(`BenefitLedger created for license: ${savedLicense.licenseId}`);
      
      // Crear schedule de beneficios (8+1 días × 5 ciclos + comisión D+17)
      await this.createBenefitSchedule(savedLicense);
      
      // Marcar la compra como procesada
      await Purchase.findByIdAndUpdate(purchase._id, {
        licenseCreated: true,
        activatedAt: savedLicense.activatedAt
      });
      
      // Emitir evento SSE
      await emitToUser(purchase.userId, 'licenseActivated', {
        licenseId: savedLicense.licenseId,
        purchaseId: purchase.purchaseId,
        principalAmount: savedLicense.principalAmount,
        status: savedLicense.status,
        activatedAt: savedLicense.activatedAt,
        totalCycles: 5,
        daysPerCycle: 8,
        totalBenefitDays: 40,
        packageName: packageData.name,
        currency: savedLicense.currency
      });
      
      logger.info(`License created for purchase ${purchaseId}: ${savedLicense.licenseId}`, {
        userId: purchase.userId,
        purchaseId: purchase.purchaseId,
        principalAmount: savedLicense.principalAmount,
        pattern: '8+1×5 cycles'
      });
      
      return savedLicense;
      
    } catch (error) {
      console.error('=== DETAILED ERROR IN LICENSE CREATION ===');
      console.error('Purchase ID:', purchaseId);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('=== END ERROR DETAILS ===');
      logger.error('Error creating license from purchase:', {
        message: error.message,
        stack: error.stack,
        purchaseId
      });
      throw error;
    }
  }

  /**
   * Crear schedule de beneficios para una licencia usando BenefitSchedule
   * Implementa patrón 8+1 días por 5 ciclos (8 días producción + 1 día pausa)
   */
  async createBenefitSchedule(license) {
    try {
      const BenefitSchedule = require('../models/BenefitSchedule');
      const Purchase = require('../models/Purchase');
      const User = require('../models/User');
      
      // Obtener la compra para acceder a información de referidos
      const purchase = await Purchase.findById(license.purchaseId).populate('userId', 'referredBy');
      if (!purchase) {
        throw new Error('Purchase not found for license creation');
      }

      const schedules = [];
      
      // 1. Crear BenefitSchedule principal (8 días de beneficios por 5 ciclos)
      for (let cycle = 1; cycle <= 5; cycle++) {
        const cycleStartDate = new Date();
        // Calcular fecha de inicio del ciclo: (cycle-1) * 9 días desde hoy
        cycleStartDate.setDate(cycleStartDate.getDate() + ((cycle - 1) * 9));
        cycleStartDate.setHours(9, 0, 0, 0); // 9 AM cada día
        
        const benefitSchedule = new BenefitSchedule({
          purchaseId: license.purchaseId,
          userId: license.userId,
          type: 'BENEFIT',
          startAt: cycleStartDate,
          days: 8, // 8 días de producción
          dailyRate: 0.125, // 12.5% diario
          purchaseAmount: license.principalAmount,
          dailyBenefitAmount: license.principalAmount * 0.125,
          scheduleStatus: 'active',
          metadata: {
            createdBy: 'licenseService',
            cycle: cycle,
            notes: `Cycle ${cycle} of 5 - 8 production days + 1 pause day`
          }
        });
        
        // Inicializar el schedule diario
        benefitSchedule.initializeDailySchedule();
        schedules.push(benefitSchedule);
      }
      
      // 2. Crear comisiones usando BenefitSchedule.createCommissionSchedules
      if (purchase.userId.referredBy) {
        const referrer = await User.findById(purchase.userId.referredBy);
        if (referrer && referrer.status === 'active') {
          // Buscar el padre (referrer del referrer) para comisión padre
          let parentUser = null;
          if (referrer.referredBy) {
            const potentialParent = await User.findById(referrer.referredBy);
            if (potentialParent && potentialParent.status === 'active') {
              // Verificar si es la primera activación del referrer
              const referrerPurchases = await Purchase.countDocuments({
                userId: referrer._id,
                status: 'ACTIVE'
              });
              
              if (referrerPurchases === 0) {
                parentUser = potentialParent;
              }
            }
          }
          
          // Crear schedules de comisiones usando el método estático
          const commissionSchedules = await BenefitSchedule.createCommissionSchedules(
            purchase,
            referrer._id,
            parentUser?._id
          );
          
          schedules.push(...commissionSchedules);
          
          logger.info(`Created commission schedules`, {
            purchaseId: purchase.purchaseId,
            referrerCommission: commissionSchedules.find(s => s.type === 'REFERRER')?.dailyBenefitAmount || 0,
            parentCommission: commissionSchedules.find(s => s.type === 'PARENT')?.dailyBenefitAmount || 0,
            referrerId: referrer._id,
            parentId: parentUser?._id
          });
        }
      }
      
      // Guardar todos los schedules
      const savedSchedules = await BenefitSchedule.insertMany(schedules);
      
      logger.info(`Created ${savedSchedules.length} benefit schedules for license ${license.licenseId}`, {
        benefitSchedules: schedules.filter(s => s.type === 'BENEFIT').length,
        commissionSchedules: schedules.filter(s => s.type === 'REFERRER').length,
        totalCycles: 5,
        daysPerCycle: 8
      });
      
      return savedSchedules;
      
    } catch (error) {
      logger.error('Error creating benefit schedule:', error);
      throw error;
    }
  }

  /**
   * Procesar beneficios diarios (cron job)
   */
  async processDailyBenefits() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Buscar beneficios programados para hoy
      const scheduledBenefits = await BenefitLedger.find({
        status: 'scheduled',
        benefitDate: {
          $gte: today,
          $lt: tomorrow
        }
      }).populate('licenseId');
      
      logger.info(`Processing ${scheduledBenefits.length} scheduled benefits for today`);
      
      for (const benefit of scheduledBenefits) {
        await this.processBenefit(benefit);
      }
      
      return scheduledBenefits.length;
      
    } catch (error) {
      logger.error('Error processing daily benefits:', error);
      throw error;
    }
  }

  /**
   * Procesar un beneficio individual con transacciones atómicas
   */
  async processBenefit(benefit) {
    const session = await License.startSession();
    
    try {
      await session.withTransaction(async () => {
        const license = await License.findById(benefit.licenseId).session(session);
        if (!license || license.status !== 'ACTIVE') {
          logger.warn(`Skipping benefit for inactive license: ${license?.licenseId}`);
          return;
        }
        
        // Marcar beneficio como disponible
        benefit.status = 'available';
        benefit.processedAt = new Date();
        await benefit.save({ session });
        
        // Actualizar licencia
        license.totalBenefitsEarned += benefit.amount;
        license.availableBalance += benefit.amount;
        license.advanceDay();
        await license.save({ session });
        
        // Crear entrada en el ledger para el beneficio
        const Ledger = require('../models/Ledger');
        const ledgerEntry = new Ledger({
          userId: license.userId,
          type: 'BENEFIT_EARNED',
          amount: benefit.amount,
          currency: benefit.currency,
          description: `Benefit earned from license ${license.licenseId} - ${benefit.benefitType}`,
          references: {
            licenseId: license._id,
            benefitId: benefit._id
          },
          idempotencyKey: `benefit_${benefit._id}`,
          transactionDate: new Date(),
          status: 'confirmed'
        });
        
        await ledgerEntry.save({ session });
        
        logger.info(`Processed benefit for license ${license.licenseId}: ${benefit.amount} ${benefit.currency}`);
      });
      
      // Emitir evento SSE fuera de la transacción
      const license = await License.findById(benefit.licenseId);
      await emitToUser(license.userId, 'benefitEarned', {
        licenseId: license.licenseId,
        benefitType: benefit.benefitType,
        amount: benefit.amount,
        currency: benefit.currency,
        cycle: benefit.cycle,
        day: benefit.day,
        availableBalance: license.availableBalance
      });
      
    } catch (error) {
      logger.error('Error processing individual benefit:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Obtener resumen de beneficios para un usuario
   */
  async getUserBenefitsSummary(userId) {
    try {
      // Licencias activas
      const activeLicenses = await License.find({
        userId,
        status: { $in: ['ACTIVE', 'PAUSED'] }
      }).populate('packageId');
      
      // Beneficios disponibles
      const availableBenefits = await BenefitLedger.aggregate([
        {
          $match: {
            userId: userId,
            status: 'available'
          }
        },
        {
          $group: {
            _id: '$currency',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]);
      
      // Beneficios programados (próximos 7 días)
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      const upcomingBenefits = await BenefitLedger.find({
        userId,
        status: 'scheduled',
        benefitDate: {
          $gte: new Date(),
          $lte: nextWeek
        }
      }).sort({ benefitDate: 1 }).limit(10);
      
      // Historial reciente
      const recentBenefits = await BenefitLedger.find({
        userId,
        status: { $in: ['available', 'withdrawn'] }
      }).sort({ processedAt: -1 }).limit(20);
      
      return {
        activeLicenses: activeLicenses.length,
        availableBalance: availableBenefits.reduce((sum, b) => sum + b.totalAmount, 0),
        availableBenefits,
        upcomingBenefits,
        recentBenefits,
        licenses: activeLicenses
      };
      
    } catch (error) {
      logger.error('Error getting user benefits summary:', error);
      throw error;
    }
  }

  /**
   * Pausar una licencia
   */
  async pauseLicense(licenseId, reason, adminUserId) {
    try {
      const license = await License.findOne({ licenseId });
      if (!license) {
        throw new Error('License not found');
      }
      
      license.pause(reason);
      await license.save();
      
      // Emitir evento SSE
      await emitToUser(license.userId, 'licensePaused', {
        licenseId: license.licenseId,
        reason,
        pausedAt: license.pausedAt
      });
      
      logger.info(`License ${licenseId} paused by admin ${adminUserId}: ${reason}`);
      return license;
      
    } catch (error) {
      logger.error('Error pausing license:', error);
      throw error;
    }
  }

  /**
   * Reanudar una licencia
   */
  async resumeLicense(licenseId, adminUserId) {
    try {
      const license = await License.findOne({ licenseId });
      if (!license) {
        throw new Error('License not found');
      }
      
      license.resume();
      await license.save();
      
      // Emitir evento SSE
      await emitToUser(license.userId, 'licenseResumed', {
        licenseId: license.licenseId,
        resumedAt: new Date()
      });
      
      logger.info(`License ${licenseId} resumed by admin ${adminUserId}`);
      return license;
      
    } catch (error) {
      logger.error('Error resuming license:', error);
      throw error;
    }
  }
}

module.exports = new LicenseService();