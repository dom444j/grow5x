// cron/health-monitor.cron.js
const cron = require('node-cron');
const mongoose = require('mongoose');
const { getAdminHealth } = require("../services/healthService");
const { notify } = require("../services/alertService");
const logger = require('../config/logger');
const logInfo = logger.info.bind(logger);
const logError = logger.error.bind(logger);

// Modelo simple para job locks
const jobSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  lockUntil: { type: Date },
  updatedAt: { type: Date, default: Date.now }
});

// Verificar si el modelo ya existe para evitar conflictos
const CronLock = mongoose.models.CronLock || mongoose.model('CronLock', jobSchema);

// simple job-lock con TTL 2.5 min
async function acquireLock(name, ttlMs=150000) {
  const now = new Date();
  const until = new Date(Date.now() + ttlMs);
  
  try {
    const res = await CronLock.findOneAndUpdate(
      { 
        name, 
        $or: [ 
          { lockUntil: { $exists: false } }, 
          { lockUntil: { $lte: now } } 
        ] 
      },
      { $set: { name, lockUntil: until, updatedAt: now } },
      { upsert: true, new: true }
    );
    return res ? true : false;
  } catch (error) {
    console.error('Lock acquisition error:', error);
    return false;
  }
}

async function run() {
  if (isRunning) {
    logInfo('Health monitor already running, skipping this execution');
    return;
  }
  
  isRunning = true;
  const startTime = Date.now();
  
  try {
    const got = await acquireLock("health-monitor", 150000);
    if (!got) {
      logInfo('Health monitor lock not acquired, another instance running');
      return;
    }
    
    const h = await getAdminHealth();

    // Umbrales (ajusta a tus reglas)
    const { walletPool, withdrawals } = h;
    const lowAvail = walletPool.counts.total > 0 && (walletPool.counts.available / walletPool.counts.total) < 0.1;
    const slaBad = withdrawals.slaHitRate7d !== null && withdrawals.slaHitRate7d < 0.7;

    if (lowAvail) {
      await notify(`⚠️ Pool bajo: disponibles ${walletPool.counts.available}/${walletPool.counts.total}`);
    }
    if (slaBad) {
      await notify(`⚠️ SLA bajo: hitRate7d=${withdrawals.slaHitRate7d}`);
    }
    
    // opcional: alerta si p90DisplayLagMin es muy alto
    if (walletPool.rotation.p90DisplayLagMin && walletPool.rotation.p90DisplayLagMin > 10) {
      await notify(`⚠️ Rotación lenta: P90 lag ${walletPool.rotation.p90DisplayLagMin} min`);
    }
    
    lastRun = new Date();
    const executionTime = Date.now() - startTime;
    
    logInfo('Health monitor completed successfully', {
      executionTimeMs: executionTime,
      timestamp: lastRun.toISOString()
    });
    
  } catch (error) {
    logError('Health monitor error:', {
      error: error.message,
      stack: error.stack,
      executionTimeMs: Date.now() - startTime
    });
    
    try {
      await notify(`🚨 Error en monitoreo de salud: ${error.message}`);
    } catch (notifyError) {
      logError('Failed to send health monitor error notification:', notifyError.message);
    }
  } finally {
    isRunning = false;
  }
}

let cronJob = null;
let isRunning = false;
let lastRun = null;

/**
 * Start the health monitor CRON job
 * Runs every 5 minutes
 */
function startCronJob() {
  if (cronJob) {
    logInfo('Health monitor CRON job already started');
    return;
  }
  
  // Schedule every 5 minutes
  cronJob = cron.schedule('*/5 * * * *', async () => {
    await run();
  }, {
    scheduled: true,
    timezone: 'America/Bogota'
  });
  
  logInfo('Health monitor CRON job started - runs every 5 minutes');
}

/**
 * Stop the health monitor CRON job
 */
function stopCronJob() {
  if (cronJob) {
    cronJob.stop();
    cronJob.destroy();
    cronJob = null;
    logInfo('Health monitor CRON job stopped');
  }
}

/**
 * Get CRON job status
 */
function getStatus() {
  return {
    running: cronJob ? cronJob.running : false,
    scheduled: cronJob ? true : false,
    isExecuting: isRunning,
    lastRun: lastRun ? lastRun.toISOString() : null,
    schedule: '*/5 * * * *',
    timezone: 'America/Bogota'
  };
}

module.exports = { 
  run, 
  startCronJob, 
  stopCronJob, 
  getStatus 
};