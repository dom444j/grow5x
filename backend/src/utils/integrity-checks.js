/**
 * Validaciones de integridad del sistema
 * Estas validaciones fallan el arranque si detectan configuraciones inválidas
 */

const Package = require('../models/Package');
const Commission = require('../models/Commission');
const pino = require('pino');

// Logger setup
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard'
    }
  } : undefined
});

/**
 * Valida que no existan referencias multinivel en el sistema
 * @throws {Error} Si encuentra configuraciones multinivel
 */
async function validateNoMultiLevel() {
  logger.info('🔍 Validando integridad: Sin referencias multinivel...');
  
  try {
    // 1. Verificar que no existan packages con commissionRates multinivel
    const packagesWithLevels = await Package.find({
      $or: [
        { 'commissionRates.level1': { $exists: true } },
        { 'commissionRates.level2': { $exists: true } },
        { 'commissionRates.level3': { $exists: true } },
        { 'commissionRates.level4': { $exists: true } },
        { 'commissionRates.level5': { $exists: true } },
        { 'commissionTiers': { $exists: true } },
        { 'levels': { $exists: true } }
      ]
    });
    
    if (packagesWithLevels.length > 0) {
      throw new Error(`❌ INTEGRIDAD VIOLADA: Encontrados ${packagesWithLevels.length} packages con configuración multinivel. Ejecutar limpieza antes de continuar.`);
    }
    
    // 2. Verificar que no existan comisiones con tipos inválidos
    const invalidCommissions = await Commission.find({
      type: { $nin: ['direct_referral', 'parent_bonus'] }
    });
    
    if (invalidCommissions.length > 0) {
      throw new Error(`❌ INTEGRIDAD VIOLADA: Encontradas ${invalidCommissions.length} comisiones con tipos inválidos. Solo se permiten 'direct_referral' y 'parent_bonus'.`);
    }
    
    // 3. Verificar que no existan comisiones con campo 'level'
    const commissionsWithLevel = await Commission.find({
      level: { $exists: true }
    });
    
    if (commissionsWithLevel.length > 0) {
      throw new Error(`❌ INTEGRIDAD VIOLADA: Encontradas ${commissionsWithLevel.length} comisiones con campo 'level'. Este campo debe ser eliminado.`);
    }
    
    logger.info('✅ Validación de integridad completada: Sistema limpio de referencias multinivel');
    
  } catch (error) {
    logger.error('❌ Error en validación de integridad:', error.message);
    throw error;
  }
}

/**
 * Valida la configuración de comisiones según normativa oficial
 */
function validateCommissionConfig() {
  logger.info('🔍 Validando configuración de comisiones...');
  
  const COMMISSIONS = require('../config/commissions');
  
  // Verificar que solo existan las configuraciones permitidas
  const allowedKeys = ['DIRECT_PERCENT', 'DIRECT_UNLOCK_DAYS', 'PARENT_PERCENT', 'PARENT_UNLOCK_DAYS'];
  const configKeys = Object.keys(COMMISSIONS);
  
  const invalidKeys = configKeys.filter(key => !allowedKeys.includes(key));
  if (invalidKeys.length > 0) {
    throw new Error(`❌ INTEGRIDAD VIOLADA: Configuración de comisiones contiene claves inválidas: ${invalidKeys.join(', ')}`);
  }
  
  // Verificar valores según normativa
  if (COMMISSIONS.DIRECT_PERCENT !== 0.10) {
    throw new Error(`❌ INTEGRIDAD VIOLADA: DIRECT_PERCENT debe ser 0.10 según normativa oficial`);
  }
  
  if (COMMISSIONS.PARENT_PERCENT !== 0.10) {
    throw new Error(`❌ INTEGRIDAD VIOLADA: PARENT_PERCENT debe ser 0.10 según normativa oficial`);
  }
  
  if (COMMISSIONS.DIRECT_UNLOCK_DAYS !== 9) {
    throw new Error(`❌ INTEGRIDAD VIOLADA: DIRECT_UNLOCK_DAYS debe ser 9 según normativa oficial`);
  }
  
  if (COMMISSIONS.PARENT_UNLOCK_DAYS !== 17) {
    throw new Error(`❌ INTEGRIDAD VIOLADA: PARENT_UNLOCK_DAYS debe ser 17 según normativa oficial`);
  }
  
  logger.info('✅ Configuración de comisiones válida según normativa oficial');
}

/**
 * Ejecuta todas las validaciones de integridad
 */
async function runIntegrityChecks() {
  logger.info('🚀 Iniciando validaciones de integridad del sistema...');
  
  try {
    validateCommissionConfig();
    await validateNoMultiLevel();
    
    logger.info('✅ Todas las validaciones de integridad completadas exitosamente');
    logger.info('📋 Fuente de verdad: "Lógica de Comisiones — MVP (Normativa)"');
    
  } catch (error) {
    logger.error('💥 FALLO CRÍTICO EN VALIDACIÓN DE INTEGRIDAD');
    logger.error('📋 Consultar: "Lógica de Comisiones — MVP (Normativa)" para configuración válida');
    throw error;
  }
}

module.exports = {
  validateNoMultiLevel,
  validateCommissionConfig,
  runIntegrityChecks
};