const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { reportsLimiter, exportLimiter } = require('../middleware/rateLimiter');
const { adminOverviewCache } = require('../middleware/cache');
const Ledger = require('../models/Ledger');
const Purchase = require('../models/Purchase');
const Commission = require('../models/Commission');
const BenefitSchedule = require('../models/BenefitSchedule');
const BenefitLedger = require('../models/BenefitLedger');
const Withdrawal = require('../models/Withdrawal');
const Package = require('../models/Package');
const Cohort = require('../models/Cohort');
const AuditLog = require('../models/AuditLog');
const dayjs = require('dayjs');
const logger = require('../config/logger');
const { DecimalCalc } = require('../utils/decimal');

// Helpers para agregaciones de Atlas
const dayStr = (tz) => ({ $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: tz } });
const toRange = (q) => {
  const start = new Date(q.start || q.from); 
  start.setHours(0,0,0,0);
  const end = new Date(q.end || q.to);   
  end.setHours(23,59,59,999);
  return { start, end, tz: q.tz || 'UTC' };
};

// Helper para convertir Decimal128 a números JS
const num = (v) => typeof v === 'number' ? v : Number(v);
const mapNum = (arr, keys) => arr.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) =>
  [k, keys.includes(k) ? num(v) : v]
)));

// Middleware para validar rangos de fechas con hardening
const validateDateRange = (req, res, next) => {
  let { from, to, start, end } = req.query;
  
  // Soporte para ambos formatos: from/to y start/end
  from = from || start;
  to = to || end;
  
  // Si no se proporcionan fechas, usar últimos 7 días por defecto
  if (!from || !to) {
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    from = sevenDaysAgo.toISOString();
    to = now.toISOString();
    
    logger.info('Using default 7-day range for reports', { from, to });
  }
  
  const fromDate = new Date(from);
  const toDate = new Date(to);
  
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return res.status(400).json({
      success: false,
      message: 'Formato de fecha inválido. Use ISO 8601'
    });
  }
  
  if (fromDate >= toDate) {
    return res.status(400).json({
      success: false,
      message: 'La fecha de inicio debe ser anterior a la fecha de fin'
    });
  }
  
  // Límite de 31 días máximo por petición (hardening)
  const daysDiff = dayjs(toDate).diff(dayjs(fromDate), 'day');
  if (daysDiff > 31) {
    return res.status(400).json({
      success: false,
      message: 'El rango de fechas no puede exceder 31 días'
    });
  }
  
  req.dateRange = { from: fromDate, to: toDate };
  next();
};

// Middleware para validar IP allowlist en exports (hardening)
const validateExportIP = (req, res, next) => {
  const allowedIPs = process.env.ADMIN_EXPORT_ALLOWLIST?.split(',') || [];
  
  if (allowedIPs.length === 0) {
    logger.logWarn('ADMIN_EXPORT_ALLOWLIST not configured');
    return res.status(403).json({
      success: false,
      message: 'Export no configurado - contacte al administrador'
    });
  }
  
  // Obtener IP real del cliente (considerando proxies)
  const clientIP = req.headers['x-forwarded-for']?.split(',')[0] || 
                   req.headers['x-real-ip'] || 
                   req.connection.remoteAddress || 
                   req.socket.remoteAddress || 
                   req.ip;
  
  const normalizedClientIP = clientIP?.replace(/^::ffff:/, ''); // Normalizar IPv4 mapeada
  const normalizedAllowedIPs = allowedIPs.map(ip => ip.trim().replace(/^::ffff:/, ''));
  
  if (!normalizedAllowedIPs.includes(normalizedClientIP)) {
    logger.logWarn('Export attempt from unauthorized IP', { 
      ip: normalizedClientIP, 
      allowedIPs: normalizedAllowedIPs,
      userAgent: req.headers['user-agent']
    });
    return res.status(403).json({
      success: false,
      message: 'IP no autorizada para export'
    });
  }
  
  logger.logInfo('Export authorized for IP', { ip: normalizedClientIP });
  next();
};

// Nueva ruta unificada de reportes con agregaciones de Atlas
router.get('/', adminOverviewCache(15), reportsLimiter, authenticateToken, requireAdmin, validateDateRange, async (req, res) => {
  try {
    const { start, end, tz } = toRange(req.query);

    // VENTAS (compras activas o pagadas)
    const sales = await Purchase.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, status: { $in: ['ACTIVE','APPROVED'] } } },
      { $group: { _id: dayStr(tz), count: { $sum: 1 }, totalAmount: { $sum: '$amountUSDT' } } },
      { $sort: { _id: 1 } },
    ]);

    // REFERIDOS (ledger)
    const referrals = await Ledger.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, type: { $in: ['REFERRAL_DIRECT','REFERRAL_INDIRECT'] } } },
      { $group: { _id: dayStr(tz), total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // BENEFICIOS personales (BenefitLedger)
    const benefits = await BenefitLedger.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, type: 'DAILY_BENEFIT', status: 'paid' } },
      { $group: { _id: dayStr(tz), total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // RETIROS
    const withdrawals = await Withdrawal.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: {
          _id: dayStr(tz),
          requested: { $sum: { $cond: [{ $eq: ['$status','REQUESTED'] }, '$amountUSDT', 0] } },
          approved:  { $sum: { $cond: [{ $eq: ['$status','APPROVED' ] }, '$amountUSDT', 0] } },
          paid:      { $sum: { $cond: [{ $eq: ['$status','PAID'     ] }, '$amountUSDT', 0] } },
        } },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      range: { start, end, tz },
      sales:      mapNum(sales,      ['count','totalAmount']),
      referrals:  mapNum(referrals,  ['count','total']),
      benefits:   mapNum(benefits,   ['count','total']),
      withdrawals: withdrawals.map(r => ({
        _id: r._id,
        requested: num(r.requested), 
        approved: num(r.approved), 
        paid: num(r.paid)
      })),
      // overview rápido
      overview: {
        salesCount: sales.reduce((a,b)=>DecimalCalc.add(a, num(b.count)),0),
        salesUSDT:  sales.reduce((a,b)=>DecimalCalc.add(a, num(b.totalAmount)),0),
        benefitsUSDT: benefits.reduce((a,b)=>DecimalCalc.add(a, num(b.total)),0),
        referralsUSDT: referrals.reduce((a,b)=>DecimalCalc.add(a, num(b.total)),0),
        withdrawalsPAID: withdrawals.reduce((a,b)=>DecimalCalc.add(a, num(b.paid)),0),
      }
    });
  } catch (error) {
    logger.error('Error in unified reports endpoint:', {
      error: error.message,
      stack: error.stack,
      query: req.query
    });
    res.status(500).json({
      success: false,
      message: 'Error generating reports',
      error: error.message
    });
  }
});

// CSV Export endpoint
router.get('/reports/export', exportLimiter, authenticateToken, requireAdmin, validateExportIP, validateDateRange, async (req, res) => {
  try {
    const { type } = req.query;
    const { start, end, tz } = toRange(req.query);
    
    let data = [];
    let filename = `${type}-report.csv`;
    
    switch (type) {
      case 'sales':
        data = await Purchase.aggregate([
          { $match: { createdAt: { $gte: start, $lte: end }, status: { $in: ['ACTIVE','APPROVED'] } } },
          { $group: { _id: dayStr(tz), count: { $sum: 1 }, totalAmount: { $sum: '$amountUSDT' } } },
          { $sort: { _id: 1 } },
        ]);
        break;
        
      case 'referrals':
        data = await Ledger.aggregate([
          { $match: { createdAt: { $gte: start, $lte: end }, type: { $in: ['REFERRAL_DIRECT','REFERRAL_INDIRECT'] } } },
          { $group: { _id: dayStr(tz), total: { $sum: '$amount' }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]);
        break;
        
      case 'benefits':
        data = await BenefitLedger.aggregate([
          { $match: { createdAt: { $gte: start, $lte: end }, type: 'DAILY_BENEFIT', status: 'paid' } },
          { $group: { _id: dayStr(tz), total: { $sum: '$amount' }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]);
        break;
        
      case 'withdrawals':
        data = await Withdrawal.aggregate([
          { $match: { createdAt: { $gte: start, $lte: end } } },
          { $group: {
              _id: dayStr(tz),
              requested: { $sum: { $cond: [{ $eq: ['$status','REQUESTED'] }, '$amountUSDT', 0] } },
              approved:  { $sum: { $cond: [{ $eq: ['$status','APPROVED' ] }, '$amountUSDT', 0] } },
              paid:      { $sum: { $cond: [{ $eq: ['$status','PAID'     ] }, '$amountUSDT', 0] } },
            } },
          { $sort: { _id: 1 } },
        ]);
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid export type. Use: sales, referrals, benefits, withdrawals'
        });
    }
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    
    // CSV Headers
    if (type === 'withdrawals') {
      res.write('date,requested,approved,paid\n');
      data.forEach(r => {
        res.write(`${r._id},${num(r.requested)},${num(r.approved)},${num(r.paid)}\n`);
      });
    } else {
      res.write('date,count,total\n');
      data.forEach(r => {
        const total = r.total || r.totalAmount || 0;
        res.write(`${r._id},${r.count || 0},${num(total)}\n`);
      });
    }
    
    res.end();
  } catch (error) {
    logger.error('Error in CSV export:', {
      error: error.message,
      stack: error.stack,
      query: req.query
    });
    res.status(500).json({
      success: false,
      message: 'Error exporting CSV',
      error: error.message
    });
  }
});

// GET /api/admin/reports/sales
router.get('/sales', adminOverviewCache(15), reportsLimiter, authenticateToken, requireAdmin, validateDateRange, async (req, res) => {
  try {
    const { from, to } = req.dateRange;
    const { cohort } = req.query;
    
    // Filtro base
    const filter = {
      status: 'confirmed',
      createdAt: { $gte: from, $lte: to }
    };
    
    // Filtro por cohorte si se especifica
    if (cohort) {
      const cohortDoc = await Cohort.findOne({ batchId: cohort });
      if (!cohortDoc) {
        return res.status(404).json({
          success: false,
          message: 'Cohorte no encontrada'
        });
      }
      filter.cohort = cohortDoc._id;
    }
    
    // Agregación para obtener totales y desglose por paquete
    const salesAgg = await Purchase.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: 'packages',
          localField: 'package',
          foreignField: '_id',
          as: 'packageInfo'
        }
      },
      { $unwind: '$packageInfo' },
      {
        $group: {
          _id: {
            packageId: '$package',
            packageName: '$packageInfo.name'
          },
          sales: { $sum: '$totalAmount' },
          transactions: { $sum: 1 }
        }
      },
      { $sort: { sales: -1 } }
    ]);
    
    // Totales generales
    const totalSales = salesAgg.reduce((sum, item) => DecimalCalc.add(sum, item.sales), 0);
    const totalTransactions = salesAgg.reduce((sum, item) => DecimalCalc.add(sum, item.transactions), 0);
    
    // Formatear desglose por paquete
    const packageBreakdown = salesAgg.map(item => ({
      packageId: item._id.packageId.toString(),
      packageName: item._id.packageName,
      sales: item.sales,
      transactions: item.transactions
    }));
    
    // Datos de cohorte si se filtró por una específica
    let cohortData = null;
    if (cohort) {
      const cohortDoc = await Cohort.findOne({ batchId: cohort });
      cohortData = {
        batchId: cohortDoc.batchId,
        name: cohortDoc.name,
        sales: totalSales,
        transactions: totalTransactions
      };
    }
    
    res.json({
      success: true,
      data: {
        totalSales,
        totalTransactions,
        packageBreakdown,
        cohortData
      },
      message: 'Reporte de ventas generado'
    });
    
  } catch (error) {
    logger.error('Error generating sales report', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// GET /api/admin/reports/referrals
router.get('/referrals', adminOverviewCache(15), reportsLimiter, authenticateToken, requireAdmin, validateDateRange, async (req, res) => {
  try {
    const { from, to } = req.dateRange;
    
    // Comisiones directas (10%)
    const directCommissions = await Commission.aggregate([
      {
        $match: {
          type: 'direct',
          createdAt: { $gte: from, $lte: to }
        }
      },
      {
        $group: {
          _id: '$status',
          total: { $sum: '$amount' }
        }
      }
    ]);
    
    // Comisiones de padre global (10%)
    const parentCommissions = await Commission.aggregate([
      {
        $match: {
          type: 'parent',
          createdAt: { $gte: from, $lte: to }
        }
      },
      {
        $group: {
          _id: '$status',
          total: { $sum: '$amount' }
        }
      }
    ]);
    
    // Formatear resultados
    const formatCommissionData = (commissions) => {
      const pending = commissions.find(c => c._id === 'pending')?.total || 0;
      const released = commissions.find(c => c._id === 'released')?.total || 0;
      return {
        pending,
        released,
        total: pending + released
      };
    };
    
    const directReferrals = formatCommissionData(directCommissions);
    const parentBonuses = formatCommissionData(parentCommissions);
    const grandTotal = directReferrals.total + parentBonuses.total;
    
    res.json({
      success: true,
      data: {
        directReferrals,
        parentBonuses,
        grandTotal
      },
      message: 'Reporte de referidos generado'
    });
    
  } catch (error) {
    logger.error('Error generating referrals report', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// GET /api/admin/reports/benefits
router.get('/benefits', adminOverviewCache(15), reportsLimiter, authenticateToken, requireAdmin, validateDateRange, async (req, res) => {
  try {
    const { from, to } = req.dateRange;
    const today = dayjs().startOf('day').toDate();
    const tomorrow = dayjs().endOf('day').toDate();
    
    // Beneficios generados hoy
    const todayBenefits = await BenefitSchedule.aggregate([
      {
        $match: {
          'statusByDay.status': 'released',
          'statusByDay.releasedAt': { $gte: today, $lte: tomorrow }
        }
      },
      {
        $unwind: '$statusByDay'
      },
      {
        $match: {
          'statusByDay.status': 'released',
          'statusByDay.releasedAt': { $gte: today, $lte: tomorrow }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $multiply: ['$dailyRate', '$purchaseAmount'] } }
        }
      }
    ]);
    
    // Beneficios generados en el rango
    const rangeBenefits = await BenefitSchedule.aggregate([
      {
        $match: {
          'statusByDay.status': 'released',
          'statusByDay.releasedAt': { $gte: from, $lte: to }
        }
      },
      {
        $unwind: '$statusByDay'
      },
      {
        $match: {
          'statusByDay.status': 'released',
          'statusByDay.releasedAt': { $gte: from, $lte: to }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $multiply: ['$dailyRate', '$purchaseAmount'] } },
          beneficiaries: { $addToSet: '$userId' }
        }
      }
    ]);
    
    // Schedules activos
    const activeSchedules = await BenefitSchedule.countDocuments({
      status: 'active'
    });
    
    const todayGenerated = todayBenefits[0]?.total || 0;
    const rangeGenerated = rangeBenefits[0]?.total || 0;
    const totalBeneficiaries = rangeBenefits[0]?.beneficiaries?.length || 0;
    
    res.json({
      success: true,
      data: {
        todayGenerated,
        rangeGenerated,
        totalBeneficiaries,
        activeBenefitSchedules: activeSchedules
      },
      message: 'Reporte de beneficios generado'
    });
    
  } catch (error) {
    logger.error('Error generating benefits report', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// GET /api/admin/reports/withdrawals
router.get('/withdrawals', adminOverviewCache(15), reportsLimiter, authenticateToken, requireAdmin, validateDateRange, async (req, res) => {
  try {
    const { from, to } = req.dateRange;
    const { status } = req.query;
    
    // Filtro base
    const filter = {
      createdAt: { $gte: from, $lte: to }
    };
    
    // Filtro por estado si se especifica
    if (status) {
      filter.status = status;
    }
    
    // Agregación por estado
    const statusBreakdown = await Withdrawal.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          amount: { $sum: '$amount' }
        }
      }
    ]);
    
    // Formatear breakdown por estado
    const formatStatusBreakdown = () => {
      const result = {
        pending: { count: 0, amount: 0 },
        approved: { count: 0, amount: 0 },
        rejected: { count: 0, amount: 0 },
        completed: { count: 0, amount: 0 }
      };
      
      statusBreakdown.forEach(item => {
        if (result[item._id]) {
          result[item._id] = {
            count: item.count,
            amount: item.amount
          };
        }
      });
      
      return result;
    };
    
    // Métricas SLA (últimos 7 días para contexto)
    const since7d = dayjs().subtract(7, 'day').toDate();
    
    const slaMetrics = await Withdrawal.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: since7d },
          completedAt: { $exists: true }
        }
      },
      {
        $project: {
          processingMinutes: {
            $divide: [
              { $subtract: ['$completedAt', '$createdAt'] },
              1000 * 60
            ]
          },
          withinSLA: {
            $lte: [
              { $divide: [{ $subtract: ['$completedAt', '$createdAt'] }, 1000 * 60] },
              { $ifNull: ['$processingTargetMinutes', 240] } // 4 horas por defecto
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgProcessingMinutes: { $avg: '$processingMinutes' },
          totalInRange: { $sum: 1 },
          slaHits: { $sum: { $cond: ['$withinSLA', 1, 0] } }
        }
      }
    ]);
    
    const slaData = slaMetrics[0] || {};
    const slaHitRate = slaData.totalInRange > 0 
      ? DecimalCalc.round(DecimalCalc.divide(slaData.slaHits, slaData.totalInRange), 2)
      : null;
    
    res.json({
      success: true,
      data: {
        statusBreakdown: formatStatusBreakdown(),
        slaMetrics: {
          avgProcessingMinutes: slaData.avgProcessingMinutes ? DecimalCalc.round(slaData.avgProcessingMinutes) : null,
          slaHitRate,
          totalInRange: slaData.totalInRange || 0
        }
      },
      message: 'Reporte de retiros generado'
    });
    
  } catch (error) {
    logger.error('Error generating withdrawals report', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// GET /api/admin/reports/export.csv
router.get('/export.csv', exportLimiter, authenticateToken, requireAdmin, validateExportIP, validateDateRange, async (req, res) => {
  try {
    const { dataset, cohort, status } = req.query;
    const { from, to } = req.dateRange;
    
    if (!dataset || !['sales', 'referrals', 'benefits', 'withdrawals'].includes(dataset)) {
      return res.status(400).json({
        success: false,
        message: 'Dataset inválido. Use: sales, referrals, benefits, withdrawals'
      });
    }
    
    let csvData = '';
    let filename = `${dataset}_${dayjs(from).format('YYYYMMDD')}_${dayjs(to).format('YYYYMMDD')}.csv`;
    
    switch (dataset) {
      case 'sales':
        const salesFilter = {
          status: 'confirmed',
          createdAt: { $gte: from, $lte: to }
        };
        if (cohort) {
          const cohortDoc = await Cohort.findOne({ batchId: cohort });
          if (cohortDoc) salesFilter.cohort = cohortDoc._id;
        }
        
        const salesData = await Purchase.find(salesFilter)
          .populate('packageId', 'name')
          .populate('userId', 'email')
          .select('purchaseId totalAmount packageId userId createdAt')
          .lean();
        
        csvData = 'Purchase ID,Amount,Package,User Email,Date\n';
        salesData.forEach(sale => {
          const userEmail = sale.userId?.email ? sale.userId.email.replace(/@.*/, '@***') : 'N/A';
          csvData += `${sale.purchaseId},${sale.totalAmount},${sale.packageId?.name || 'N/A'},${userEmail},${dayjs(sale.createdAt).format('YYYY-MM-DD HH:mm')}\n`;
        });
        break;
        
      case 'withdrawals':
        const withdrawalFilter = {
          createdAt: { $gte: from, $lte: to }
        };
        if (status) withdrawalFilter.status = status;
        
        const withdrawalData = await Withdrawal.find(withdrawalFilter)
          .populate('userId', 'email')
          .select('amount status address userId createdAt completedAt')
          .lean();
        
        csvData = 'Amount,Status,Address,User Email,Created,Completed\n';
        withdrawalData.forEach(withdrawal => {
          const userEmail = withdrawal.userId?.email ? withdrawal.userId.email.replace(/@.*/, '@***') : 'N/A';
          const address = withdrawal.address ? withdrawal.address.substring(0, 6) + '***' + withdrawal.address.substring(withdrawal.address.length - 4) : 'N/A';
          const completed = withdrawal.completedAt ? dayjs(withdrawal.completedAt).format('YYYY-MM-DD HH:mm') : 'N/A';
          csvData += `${withdrawal.amount},${withdrawal.status},${address},${userEmail},${dayjs(withdrawal.createdAt).format('YYYY-MM-DD HH:mm')},${completed}\n`;
        });
        break;
        
      case 'referrals':
        const referralFilter = {
          createdAt: { $gte: from, $lte: to }
        };
        if (status) referralFilter.status = status;
        
        const referralData = await Commission.find(referralFilter)
          .populate('recipientUserId', 'email')
          .populate('sourceUserId', 'email')
          .select('type amount status recipientUserId sourceUserId createdAt releasedAt')
          .lean();
        
        csvData = 'Type,Amount,Status,User Email,Referred Email,Created,Released\n';
        referralData.forEach(commission => {
          const userEmail = commission.recipientUserId?.email ? commission.recipientUserId.email.replace(/@.*/, '@***') : 'N/A';
          const referredEmail = commission.sourceUserId?.email ? commission.sourceUserId.email.replace(/@.*/, '@***') : 'N/A';
          const type = commission.type === 'REFERRAL_DIRECT' ? 'DIRECT' : commission.type === 'GLOBAL_PARENT' ? 'PARENT_GLOBAL' : commission.type;
          const released = commission.releasedAt ? dayjs(commission.releasedAt).format('YYYY-MM-DD HH:mm') : 'N/A';
          csvData += `${type},${commission.amount},${commission.status},${userEmail},${referredEmail},${dayjs(commission.createdAt).format('YYYY-MM-DD HH:mm')},${released}\n`;
        });
        break;
        
      case 'benefits':
        const benefitFilter = {
          createdAt: { $gte: from, $lte: to }
        };
        if (status) benefitFilter.status = status;
        
        const benefitData = await BenefitSchedule.find(benefitFilter)
          .populate('userId', 'email')
          .select('amount status userId createdAt releasedAt')
          .lean();
        
        csvData = 'Amount,Status,User Email,Created,Released\n';
        benefitData.forEach(benefit => {
          const userEmail = benefit.userId?.email ? benefit.userId.email.replace(/@.*/, '@***') : 'N/A';
          const released = benefit.releasedAt ? dayjs(benefit.releasedAt).format('YYYY-MM-DD HH:mm') : 'N/A';
          csvData += `${benefit.amount},${benefit.status},${userEmail},${dayjs(benefit.createdAt).format('YYYY-MM-DD HH:mm')},${released}\n`;
        });
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: 'Dataset no implementado para export'
        });
    }
    
    // Auditoría de la exportación
    await AuditLog.logAction({
      actorId: req.user.id,
      action: 'report_export',
      targetId: `${dataset}_${dayjs(from).format('YYYYMMDD')}_${dayjs(to).format('YYYYMMDD')}`,
      targetType: 'Report',
      diff: {
        before: null,
        after: {
          dataset,
          dateRange: { from: from.toISOString(), to: to.toISOString() },
          cohort: cohort || null,
          status: status || null,
          recordCount: csvData.split('\n').length - 2 // Excluir header y última línea vacía
        }
      },
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent') || 'Unknown',
      notes: `CSV export: ${dataset} dataset`,
      requestId: req.headers['x-request-id'] || null
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvData);
    
  } catch (error) {
    logger.error('Error generating CSV export', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

module.exports = router;