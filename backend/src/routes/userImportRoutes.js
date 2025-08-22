const express = require('express');
const rateLimit = require('express-rate-limit');
const userImportController = require('../controllers/userImportController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { requireV1Admin, requireV1AdminOrSupport } = require('../middleware/v1Rbac');
const { validateRequest } = require('../middleware/validation');
const { body, param, query } = require('express-validator');
const { DecimalCalc } = require('../utils/decimal');

const router = express.Router();

// Rate limiting for import operations
const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 uploads per window
  message: {
    success: false,
    message: 'Too many upload attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const runRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 runs per window
  message: {
    success: false,
    message: 'Too many run attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Validation schemas
const uploadValidation = [
  body('cohort')
    .notEmpty()
    .withMessage('Cohort is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Cohort must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Cohort can only contain letters, numbers, underscores and hyphens'),
  body('requireReferralCode')
    .optional()
    .isBoolean()
    .withMessage('requireReferralCode must be a boolean')
];

const jobIdValidation = [
  param('jobId')
    .notEmpty()
    .withMessage('Job ID is required')
    .matches(/^IMPORT_[A-Z0-9]{12}$/)
    .withMessage('Invalid job ID format')
];

const listValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(['queued', 'running', 'completed', 'failed', 'partial'])
    .withMessage('Invalid status value'),
  query('cohort')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Cohort must be between 1 and 100 characters')
];

const reportValidation = [
  ...jobIdValidation,
  query('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('Format must be json or csv'),
  query('includeErrors')
    .optional()
    .isBoolean()
    .withMessage('includeErrors must be a boolean')
];

// Feature flag middleware
const checkImportEnabled = (req, res, next) => {
  if (process.env.ENABLE_USER_IMPORT !== '1') {
    return res.status(403).json({
      success: false,
      message: 'User import feature is disabled',
      code: 'FEATURE_DISABLED'
    });
  }
  next();
};

// File size validation middleware
const checkFileSize = (req, res, next) => {
  const maxSize = parseInt(process.env.USER_IMPORT_MAX_FILE_SIZE) || 50 * 1024 * 1024; // 50MB default
  
  if (req.file && req.file.size > maxSize) {
    return res.status(413).json({
      success: false,
      message: `File too large. Maximum size is ${DecimalCalc.round(maxSize / 1024 / 1024)}MB`,
      code: 'FILE_TOO_LARGE'
    });
  }
  next();
};

// Routes

/**
 * @route POST /api/v1/users-import/upload
 * @desc Upload a file for user import
 * @access Admin only
 */
router.post('/upload',
  authenticateToken,
  requireV1Admin,
  checkImportEnabled,
  uploadRateLimit,
  userImportController.upload.single('file'),
  checkFileSize,
  uploadValidation,
  validateRequest,
  userImportController.uploadFile
);

/**
 * @route POST /api/v1/users-import/:jobId/run
 * @desc Start processing an uploaded import job
 * @access Admin only
 */
router.post('/:jobId/run',
  authenticateToken,
  requireV1Admin,
  checkImportEnabled,
  runRateLimit,
  jobIdValidation,
  validateRequest,
  userImportController.runImport
);

/**
 * @route GET /api/v1/users-import/:jobId/status
 * @desc Get the status of an import job
 * @access Admin or Support
 */
router.get('/:jobId/status',
  authenticateToken,
  requireV1AdminOrSupport,
  jobIdValidation,
  validateRequest,
  userImportController.getJobStatus
);

/**
 * @route GET /api/v1/users-import/:jobId/report
 * @desc Get detailed report of an import job
 * @access Admin or Support
 */
router.get('/:jobId/report',
  authenticateToken,
  requireV1AdminOrSupport,
  reportValidation,
  validateRequest,
  userImportController.getJobReport
);

/**
 * @route GET /api/admin/import-jobs
 * @desc List all import jobs with pagination and filtering (root route)
 * @access Admin or Support
 */
router.get('/',
  authenticateToken,
  requireV1AdminOrSupport,
  listValidation,
  validateRequest,
  userImportController.listJobs
);

/**
 * @route GET /api/v1/users-import/jobs
 * @desc List all import jobs with pagination and filtering
 * @access Admin or Support
 */
router.get('/jobs',
  authenticateToken,
  requireV1AdminOrSupport,
  listValidation,
  validateRequest,
  userImportController.listJobs
);

/**
 * @route GET /api/v1/users-import/health
 * @desc Get import system health metrics
 * @access Admin or Support
 */
router.get('/health',
  authenticateToken,
  requireV1AdminOrSupport,
  async (req, res) => {
    try {
      const UserImportJob = require('../models/UserImportJob');
      const UserImportRow = require('../models/UserImportRow');
      
      // Get running jobs
      const runningJobs = await UserImportJob.countDocuments({ status: 'running' });
      
      // Get last completed job
      const lastJob = await UserImportJob.findOne(
        { status: { $in: ['completed', 'failed', 'partial'] } },
        { jobId: 1, status: 1, totalRows: 1, validRows: 1, invalidRows: 1, importedRows: 1, duration: 1 }
      ).sort({ finishedAt: -1 });
      
      // Calculate rows per minute for last 24 hours
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentStats = await UserImportJob.aggregate([
        {
          $match: {
            status: { $in: ['completed', 'partial'] },
            finishedAt: { $gte: since24h }
          }
        },
        {
          $group: {
            _id: null,
            totalRows: { $sum: '$importedRows' },
            totalDuration: { $sum: { $subtract: ['$finishedAt', '$startedAt'] } }
          }
        }
      ]);
      
      const rowsPerMinute = recentStats.length > 0 && recentStats[0].totalDuration > 0
        ? DecimalCalc.round((recentStats[0].totalRows / recentStats[0].totalDuration) * 60000)
        : 0;
      
      // Get job statistics for last 24 hours
      const jobStats = await UserImportJob.getJobStatistics(24);
      
      res.json({
        success: true,
        data: {
          imports: {
            runningJobs,
            lastJob: lastJob ? {
              jobId: lastJob.jobId,
              status: lastJob.status,
              duration: lastJob.duration,
              totalRows: lastJob.totalRows,
              validRows: lastJob.validRows,
              invalidRows: lastJob.invalidRows,
              importedRows: lastJob.importedRows,
              successRate: lastJob.totalRows > 0 ? DecimalCalc.round((lastJob.importedRows / lastJob.totalRows) * 100) : 0
            } : null,
            rowsPerMinute,
            last24Hours: {
              statistics: jobStats,
              processedRows: recentStats.length > 0 ? recentStats[0].totalRows : 0
            }
          },
          featureFlags: {
            enabled: process.env.ENABLE_USER_IMPORT === '1',
            maxRows: parseInt(process.env.USER_IMPORT_MAX_ROWS) || 100000,
            requireReferralCode: process.env.REQUIRE_REFERRAL_CODE === '1'
          }
        }
      });
      
    } catch (error) {
      console.error('Import health check error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get import health metrics',
        error: error.message
      });
    }
  }
);

// Error handling middleware specific to import routes
router.use((error, req, res, next) => {
  console.error('User import route error:', error);
  
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'File too large',
      code: 'FILE_TOO_LARGE'
    });
  }
  
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Unexpected file field',
      code: 'INVALID_FILE_FIELD'
    });
  }
  
  if (error.message && error.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type. Only CSV, Excel, and JSON files are allowed.',
      code: 'INVALID_FILE_TYPE'
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Internal server error in user import',
    code: 'INTERNAL_ERROR'
  });
});

module.exports = router;