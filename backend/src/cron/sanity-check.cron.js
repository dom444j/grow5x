/**
 * Sanity Check CRON Job
 * Ejecuta verificaciones diarias de integridad de datos
 */

const cron = require('node-cron');
const { runSanityChecks } = require('../../scripts/sanity-check');
const logger = require('../config/logger');
const logInfo = logger.info.bind(logger);
const logError = logger.error.bind(logger);
const operationFlags = require('../config/operationFlags');

let cronJob = null;
let isRunning = false;
let lastRun = null;
let lastResults = null;

/**
 * Inicia el trabajo CRON de sanity checks
 * Programado para ejecutarse diariamente a las 3:30 AM UTC
 */
function startCronJob() {
  if (cronJob) {
    logInfo('Sanity check CRON job ya está iniciado');
    return;
  }
  
  // Solo ejecutar si los CRON jobs están habilitados
  if (!operationFlags.areCronJobsEnabled()) {
    logInfo('CRON jobs deshabilitados - sanity check no se iniciará');
    return;
  }
  
  // Programar para las 3:30 AM America/Bogota (UTC-5) diariamente
  cronJob = cron.schedule('30 3 * * *', async () => {
    await executeSanityCheck();
  }, {
    scheduled: true,
    timezone: 'America/Bogota'
  });
  
  logInfo('Sanity check CRON job iniciado - se ejecuta diariamente a las 03:30 America/Bogota (UTC-5)');
}

/**
 * Detiene el trabajo CRON de sanity checks
 */
function stopCronJob() {
  if (cronJob) {
    cronJob.stop();
    cronJob.destroy();
    cronJob = null;
    logInfo('Sanity check CRON job detenido');
  }
}

/**
 * Ejecuta las verificaciones de sanidad
 */
async function executeSanityCheck() {
  if (isRunning) {
    logInfo('Sanity check ya está ejecutándose, saltando esta ejecución');
    return;
  }
  
  isRunning = true;
  const startTime = Date.now();
  
  try {
    logInfo('Iniciando ejecución programada de sanity checks...');
    
    const results = await runSanityChecks();
    
    lastRun = new Date();
    lastResults = results;
    
    const executionTime = Date.now() - startTime;
    
    logInfo('Sanity check CRON completado exitosamente', {
      executionTimeMs: executionTime,
      totalIssues: results.summary.totalIssues,
      criticalIssues: results.summary.criticalIssues,
      status: results.summary.status
    });
    
    // Log detallado de resultados
    if (results.summary.totalIssues > 0) {
      logInfo('Detalles de issues encontrados en sanity check', {
        withdrawals: results.checks.withdrawals,
        ledger: results.checks.ledger,
        purchases: results.checks.purchases,
        referrals: results.checks.referrals
      });
    }
    
  } catch (error) {
    logError('Error en ejecución programada de sanity checks', {
      error: error.message,
      stack: error.stack,
      executionTimeMs: Date.now() - startTime
    });
    
    lastResults = {
      timestamp: new Date().toISOString(),
      error: error.message,
      summary: {
        status: 'error',
        totalIssues: -1,
        criticalIssues: -1
      }
    };
  } finally {
    isRunning = false;
  }
}

/**
 * Ejecuta sanity check manualmente (para testing)
 */
async function triggerManualCheck() {
  logInfo('Ejecutando sanity check manual...');
  await executeSanityCheck();
  return lastResults;
}

/**
 * Obtiene el estado del CRON job
 */
function getStatus() {
  return {
    running: cronJob ? cronJob.running : false,
    scheduled: cronJob ? true : false,
    isExecuting: isRunning,
    lastRun: lastRun ? lastRun.toISOString() : null,
    lastResults: lastResults ? {
      timestamp: lastResults.timestamp,
      status: lastResults.summary.status,
      totalIssues: lastResults.summary.totalIssues,
      criticalIssues: lastResults.summary.criticalIssues,
      executionTimeMs: lastResults.executionTimeMs
    } : null,
    nextRun: cronJob ? 'Daily at 03:30 America/Bogota (UTC-5)' : null
  };
}

/**
 * Obtiene estadísticas de ejecución
 */
function getStats() {
  return {
    lastRun,
    lastResults,
    isRunning,
    cronActive: cronJob ? cronJob.running : false
  };
}

module.exports = {
  startCronJob,
  stopCronJob,
  executeSanityCheck,
  triggerManualCheck,
  getStatus,
  getStats
};