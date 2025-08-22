// healthService.js
const { ObjectId } = require("mongodb");
const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const Withdrawal = require('../models/Withdrawal');
const UserImportJob = require('../models/UserImportJob');
const UserImportRow = require('../models/UserImportRow');

// Util: minutos
const mins = (ms) => Math.round(ms / 60000);

async function getWalletPoolMetrics() {
  const total = await Wallet.countDocuments({ network: "BEP20", currency: "USDT" });
  const disabled = await Wallet.countDocuments({ network: "BEP20", currency: "USDT", status: "disabled" });
  const available = total - disabled;

  // "Display lag" = ahora - lastShownAt (min); robusto para Pool V2 (LRS)
  const now = Date.now();
  const docs = await Wallet.find(
    { network: "BEP20", currency: "USDT", status: { $ne: "disabled" } },
    { lastShownAt: 1, shownCount: 1 }
  ).lean();

  const lags = docs.map(d => mins(now - (d.lastShownAt ? new Date(d.lastShownAt).getTime() : 0)));
  lags.sort((a,b)=>a-b);
  const median = lags.length ? lags[Math.floor(lags.length/2)] : null;
  const p90 = lags.length ? lags[Math.floor(lags.length*0.9)-1] ?? lags[lags.length-1] : null;

  // sesgo de rotación: max(shownCount)/min(shownCount>0)
  const counts = docs.map(d => d.shownCount || 0).filter(n => n>0);
  const skew = counts.length ? (Math.max(...counts) / Math.min(...counts)) : 1;

  return {
    total, available, disabled,
    rotation: {
      medianDisplayLagMin: median,
      p90DisplayLagMin: p90,
      skewShownCount90d: Number.isFinite(skew) ? Number(skew.toFixed(2)) : null
    },
    lastShownAt: docs.reduce((max, d) => Math.max(max, d.lastShownAt ? new Date(d.lastShownAt).getTime() : 0), 0) || null
  };
}

async function getWithdrawalsSlaMetrics() {
  const since = new Date(Date.now() - 7*24*60*60*1000);

  // Promedio real de procesamiento (aprobado→completado) últimos 7d
  const avgAgg = await Withdrawal.aggregate([
    { $match: { approvedAt: { $gte: since }, status: "completed", completedAt: { $exists: true } } },
    { $project: { minutes: { $divide: [{ $subtract: ["$completedAt", "$approvedAt"] }, 60000] } } },
    { $group: { _id: null, avgMin: { $avg: "$minutes" }, n: { $sum: 1 } } }
  ]);
  const avgProcessingMinutes7d = avgAgg[0]?.avgMin ? Math.round(avgAgg[0].avgMin) : null;

  // SLA hit rate: completados antes de su processingETA
  const slaAgg = await Withdrawal.aggregate([
    { $match: { approvedAt: { $gte: since }, status: "completed", processingETA: { $exists: true } } },
    { $project: { hit: { $cond: [{ $lte: ["$completedAt", "$processingETA"] }, 1, 0] } } },
    { $group: { _id: null, hits: { $sum: "$hit" }, total: { $sum: 1 } } }
  ]);
  const slaHitRate7d = slaAgg[0]?.total ? Number((slaAgg[0].hits / slaAgg[0].total).toFixed(2)) : null;

  // Conteos básicos
  const statusCounts = await Withdrawal.aggregate([
    { $group: { _id: "$status", total: { $sum: 1 } } }
  ]);
  const toDict = Object.fromEntries(statusCounts.map(s=>[s._id, s.total]));

  return {
    pending: toDict.pending || 0,
    processing: toDict.processing || 0,
    completed24h: await Withdrawal.countDocuments({ status:"completed", completedAt: { $gte: new Date(Date.now()-24*60*60*1000) } }),
    avgProcessingMinutes7d,
    slaHitRate7d
  };
}

function getProcessVitals() {
  const mu = process.memoryUsage();
  return {
    uptimeSec: Math.round(process.uptime()),
    rssMB: Math.round(mu.rss/1024/1024),
    heapUsedMB: Math.round(mu.heapUsed/1024/1024)
  };
}

async function getImportMetrics() {
  // Running jobs count
  const runningJobs = await UserImportJob.countDocuments({ 
    status: { $in: ['running', 'processing'] } 
  });

  // Last completed job metrics
  const lastJob = await UserImportJob.findOne(
    { status: { $in: ['completed', 'failed'] } },
    {},
    { sort: { updatedAt: -1 } }
  );

  let lastJobMetrics = null;
  if (lastJob) {
    const duration = lastJob.completedAt && lastJob.startedAt 
      ? Math.round((new Date(lastJob.completedAt) - new Date(lastJob.startedAt)) / 60000) // minutes
      : null;

    // Get row counts for last job
    const rowCounts = await UserImportRow.aggregate([
      { $match: { jobId: lastJob.jobId } },
      { 
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusCounts = Object.fromEntries(rowCounts.map(r => [r._id, r.count]));
    const valid = (statusCounts.imported || 0) + (statusCounts.would_be_imported || 0);
    const invalid = statusCounts.failed || 0;
    const total = valid + invalid;

    // Calculate rows per minute
    const rowsPerMinute = duration && duration > 0 ? Math.round(total / duration) : null;

    lastJobMetrics = {
      status: lastJob.status,
      duration,
      valid,
      invalid,
      total,
      rowsPerMinute,
      executionMode: lastJob.executionMode || 'unknown',
      completedAt: lastJob.completedAt ? lastJob.completedAt.toISOString() : null
    };
  }

  return {
    runningJobs,
    last: lastJobMetrics
  };
}

async function getAdminHealth() {
  const walletPool = await getWalletPoolMetrics();
  const withdrawals = await getWithdrawalsSlaMetrics();
  const imports = await getImportMetrics();
  const vitals = getProcessVitals();

  const poolSaturation = walletPool.total > 0
    ? Number((1 - (walletPool.available / walletPool.total)).toFixed(2))
    : null;

  return {
    ts: new Date().toISOString(),
    walletPool: {
      network: "BEP20",
      currency: "USDT",
      counts: { total: walletPool.total, available: walletPool.available, disabled: walletPool.disabled },
      rotation: walletPool.rotation,
      poolSaturation,
      lastShownAt: walletPool.lastShownAt ? new Date(walletPool.lastShownAt).toISOString() : null
    },
    withdrawals,
    imports,
    vitals
  };
}

module.exports = { getAdminHealth };