const logger = require('../config/logger');
const { Commission } = require('../models');
const dayjs = require('dayjs');

/**
 * Desbloquea comisiones pendientes según las reglas de negocio
 * Ejecuta diariamente a las 03:00 UTC
 * - Comisiones directas: pending → available en D+9
 * - Comisiones de equipo: pending → available en D+17
 */
async function unlockCommissions() {
  try {
    logger.info('🔓 Iniciando desbloqueo de comisiones...');
    
    const today = dayjs();
    
    // Fecha límite para comisiones directas (D+9)
    const directUnlockDate = today.subtract(9, 'days').startOf('day').toDate();
    
    // Fecha límite para comisiones de equipo (D+17)
    const teamUnlockDate = today.subtract(17, 'days').startOf('day').toDate();
    
    let directUnlocked = 0;
    let teamUnlocked = 0;
    let errorCount = 0;
    
    // Desbloquear comisiones directas (D+9)
    try {
      const directCommissions = await Commission.find({
        status: 'pending',
        type: 'direct',
        createdAt: { $lte: directUnlockDate }
      });
      
      logger.info(`📊 Encontradas ${directCommissions.length} comisiones directas para desbloquear`);
      
      for (const commission of directCommissions) {
        try {
          commission.status = 'available';
          commission.unlockedAt = new Date();
          await commission.save();
          
          directUnlocked++;
          logger.debug(`✅ Comisión directa desbloqueada: ${commission.amount} USDT para usuario ${commission.userId}`);
          
        } catch (error) {
          errorCount++;
          logger.error(`❌ Error desbloqueando comisión directa ${commission._id}:`, error.message);
        }
      }
      
    } catch (error) {
      logger.error('❌ Error procesando comisiones directas:', error);
    }
    
    // Desbloquear comisiones de equipo (D+17)
    try {
      const teamCommissions = await Commission.find({
        status: 'pending',
        type: { $in: ['team', 'binary', 'leadership'] },
        createdAt: { $lte: teamUnlockDate }
      });
      
      logger.info(`📊 Encontradas ${teamCommissions.length} comisiones de equipo para desbloquear`);
      
      for (const commission of teamCommissions) {
        try {
          commission.status = 'available';
          commission.unlockedAt = new Date();
          await commission.save();
          
          teamUnlocked++;
          logger.debug(`✅ Comisión de equipo desbloqueada: ${commission.amount} USDT para usuario ${commission.userId}`);
          
        } catch (error) {
          errorCount++;
          logger.error(`❌ Error desbloqueando comisión de equipo ${commission._id}:`, error.message);
        }
      }
      
    } catch (error) {
      logger.error('❌ Error procesando comisiones de equipo:', error);
    }
    
    // Actualizar balances de usuarios con comisiones desbloqueadas
    try {
      const { User } = require('../models');
      
      // Obtener usuarios únicos con comisiones desbloqueadas
      const unlockedCommissions = await Commission.find({
        status: 'available',
        unlockedAt: { $gte: today.startOf('day').toDate() }
      });
      
      const userIds = [...new Set(unlockedCommissions.map(c => c.userId.toString()))];
      
      for (const userId of userIds) {
        const userCommissions = unlockedCommissions.filter(c => c.userId.toString() === userId);
        const totalAmount = userCommissions.reduce((sum, c) => sum + c.amount, 0);
        
        if (totalAmount > 0) {
          await User.findByIdAndUpdate(userId, {
            $inc: { 'balances.available': totalAmount }
          });
          
          logger.debug(`💰 Balance actualizado: +${totalAmount} USDT para usuario ${userId}`);
        }
      }
      
    } catch (error) {
      logger.error('❌ Error actualizando balances de usuarios:', error);
    }
    
    const totalUnlocked = directUnlocked + teamUnlocked;
    logger.info(`✅ Desbloqueo completado: ${directUnlocked} directas, ${teamUnlocked} de equipo, ${errorCount} errores`);
    
    return {
      success: true,
      directUnlocked,
      teamUnlocked,
      totalUnlocked,
      errors: errorCount
    };
    
  } catch (error) {
    logger.error('❌ Error en desbloqueo de comisiones:', error);
    throw error;
  }
}

module.exports = {
  unlockCommissions
};