const logger = require('../config/logger');
const { User, Purchase, BenefitLedger } = require('../models');
const dayjs = require('dayjs');

/**
 * Procesa los beneficios diarios para todas las compras activas
 * Ejecuta diariamente a las 03:00 UTC
 * Otorga 12.5% diario por 8 días, durante 5 ciclos (total 40 días)
 */
async function processDailyBenefits() {
  try {
    logger.info('🔄 Iniciando procesamiento de beneficios diarios...');
    
    const today = dayjs().startOf('day');
    
    // Buscar todas las compras activas que necesitan procesamiento
    const activePurchases = await Purchase.find({
      status: 'active',
      isActive: true,
      $expr: {
        $lt: ['$currentDay', '$totalDays'] // currentDay < totalDays (40)
      }
    }).populate('userId', 'email username');
    
    logger.info(`📊 Encontradas ${activePurchases.length} compras activas para procesar`);
    
    let processedCount = 0;
    let errorCount = 0;
    
    for (const purchase of activePurchases) {
      try {
        // Verificar si ya se procesó hoy
        const existingBenefit = await BenefitLedger.findOne({
          userId: purchase.userId._id,
          purchaseId: purchase._id,
          date: today.toDate(),
          type: 'daily_benefit'
        });
        
        if (existingBenefit) {
          logger.debug(`⏭️  Beneficio ya procesado para compra ${purchase._id}`);
          continue;
        }
        
        // Calcular beneficio diario (12.5% del monto de compra)
        const dailyBenefit = purchase.amount * 0.125;
        
        // Crear registro en BenefitLedger
        const benefitRecord = new BenefitLedger({
          userId: purchase.userId._id,
          purchaseId: purchase._id,
          type: 'daily_benefit',
          amount: dailyBenefit,
          date: today.toDate(),
          cycle: Math.floor(purchase.currentDay / 8) + 1,
          day: (purchase.currentDay % 8) + 1,
          description: `Beneficio diario día ${purchase.currentDay + 1}/40 - Ciclo ${Math.floor(purchase.currentDay / 8) + 1}`
        });
        
        await benefitRecord.save();
        
        // Actualizar currentDay en Purchase
        purchase.currentDay += 1;
        
        // Si completó los 40 días, marcar como completada
        if (purchase.currentDay >= purchase.totalDays) {
          purchase.status = 'completed';
          purchase.isActive = false;
          purchase.completedAt = new Date();
          logger.info(`✅ Compra ${purchase._id} completada después de 40 días`);
        }
        
        await purchase.save();
        
        // Actualizar balance del usuario
        const user = await User.findById(purchase.userId._id);
        if (user) {
          user.balances.available += dailyBenefit;
          await user.save();
        }
        
        processedCount++;
        logger.debug(`💰 Beneficio procesado: ${dailyBenefit} USDT para usuario ${purchase.userId.username}`);
        
      } catch (error) {
        errorCount++;
        logger.error(`❌ Error procesando compra ${purchase._id}:`, error.message);
      }
    }
    
    logger.info(`✅ Procesamiento completado: ${processedCount} beneficios procesados, ${errorCount} errores`);
    
    return {
      success: true,
      processed: processedCount,
      errors: errorCount,
      total: activePurchases.length
    };
    
  } catch (error) {
    logger.error('❌ Error en procesamiento de beneficios diarios:', error);
    throw error;
  }
}

module.exports = {
  processDailyBenefits
};