const mongoose = require('mongoose');
const multer = require('multer');
const { GridFSBucket } = require('mongodb');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const UserImportJob = require('../models/UserImportJob');
const UserImportRow = require('../models/UserImportRow');
const User = require('../models/User');
const CohortService = require('../services/cohortService');
const { v4: uuidv4 } = require('uuid');
const { Readable } = require('stream');

// GridFS setup
let gridFSBucket;
mongoose.connection.once('open', () => {
  gridFSBucket = new GridFSBucket(mongoose.connection.db, {
    bucketName: 'userImports'
  });
});

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.USER_IMPORT_MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB default
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV, Excel, and JSON files are allowed.'));
    }
  }
});

// Validation functions
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhone = (phone) => {
  if (!phone) return true; // Optional field
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/[\s-()]/g, ''));
};

const validateReferralCode = (code) => {
  if (!code) return true; // Optional field
  const codeRegex = /^[A-Z0-9]{6,12}$/;
  return codeRegex.test(code);
};

// Data normalization
const normalizeUserData = (rawData) => {
  const normalized = {
    email: rawData.email ? rawData.email.toString().trim().toLowerCase() : null,
    firstName: rawData.firstName || rawData.first_name || rawData.nombre || null,
    lastName: rawData.lastName || rawData.last_name || rawData.apellido || null,
    phone: rawData.phone || rawData.telefono || rawData.celular || null,
    referralCode: rawData.referralCode || rawData.referral_code || rawData.codigo_referido || null,
    referredBy: rawData.referredBy || rawData.referred_by || rawData.referido_por || null,
    cohort: rawData.cohort || rawData.cohorte || null,
    role: rawData.role || rawData.rol || 'user',
    isActive: rawData.isActive !== undefined ? Boolean(rawData.isActive) : true,
    metadata: {}
  };
  
  // Clean phone number
  if (normalized.phone) {
    normalized.phone = normalized.phone.toString().replace(/[\s-()]/g, '');
    if (!normalized.phone.startsWith('+')) {
      normalized.phone = '+' + normalized.phone;
    }
  }
  
  // Clean referral codes
  if (normalized.referralCode) {
    normalized.referralCode = normalized.referralCode.toString().trim().toUpperCase();
  }
  
  if (normalized.referredBy) {
    normalized.referredBy = normalized.referredBy.toString().trim().toUpperCase();
  }
  
  // Clean names
  if (normalized.firstName) {
    normalized.firstName = normalized.firstName.toString().trim();
  }
  
  if (normalized.lastName) {
    normalized.lastName = normalized.lastName.toString().trim();
  }
  
  return normalized;
};

// Validation function
const validateUserData = async (normalized, requireReferralCode = false) => {
  const errors = [];
  
  // Required fields
  if (!normalized.email) {
    errors.push({
      field: 'email',
      code: 'REQUIRED_FIELD_MISSING',
      message: 'Email is required',
      value: normalized.email
    });
  } else if (!validateEmail(normalized.email)) {
    errors.push({
      field: 'email',
      code: 'INVALID_EMAIL_FORMAT',
      message: 'Invalid email format',
      value: normalized.email
    });
  }
  
  // Check if email already exists (unique validation)
  if (normalized.email) {
    const existingUser = await User.findOne({ email: normalized.email });
    if (existingUser) {
      errors.push({
        field: 'email',
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'Email already exists in database',
        value: normalized.email
      });
    }
  }
  
  // Phone validation (optional but must be valid if provided)
  if (normalized.phone && !validatePhone(normalized.phone)) {
    errors.push({
      field: 'phone',
      code: 'INVALID_PHONE_FORMAT',
      message: 'Invalid phone format',
      value: normalized.phone
    });
  }
  
  // Referral code validation based on REQUIRE_REFERRAL_CODE flag
  if (requireReferralCode && !normalized.referralCode) {
    errors.push({
      field: 'referralCode',
      code: 'REQUIRED_FIELD_MISSING',
      message: 'Referral code is required',
      value: normalized.referralCode
    });
  }
  
  if (normalized.referralCode && !validateReferralCode(normalized.referralCode)) {
    errors.push({
      field: 'referralCode',
      code: 'INVALID_REFERRAL_CODE',
      message: 'Invalid referral code format',
      value: normalized.referralCode
    });
  }
  
  // Check if referral code already exists (unique validation)
  if (normalized.referralCode) {
    const existingCode = await User.findOne({ referralCode: normalized.referralCode });
    if (existingCode) {
      errors.push({
        field: 'referralCode',
        code: 'REFERRAL_CODE_ALREADY_EXISTS',
        message: 'Referral code already exists',
        value: normalized.referralCode
      });
    }
  }
  
  // Check if referrer exists (direct level 1 validation)
  if (normalized.referredBy) {
    const referrer = await User.findOne({ referralCode: normalized.referredBy });
    if (!referrer) {
      errors.push({
        field: 'referredBy',
        code: 'REFERRER_NOT_FOUND',
        message: 'Referrer not found',
        value: normalized.referredBy
      });
    }
  }
  
  // Special parent code detection (mark in metadata without assignment logic)
  if (normalized.referredBy && normalized.referredBy.startsWith('PADRE_')) {
    // Mark special parent code in metadata for later processing
    normalized.metadata.specialParentCode = normalized.referredBy;
    normalized.metadata.hasSpecialParentCode = true;
    // Don't validate existence for special parent codes
  }
  
  // Name validation
  if (normalized.firstName && normalized.firstName.length > 50) {
    errors.push({
      field: 'firstName',
      code: 'FIELD_TOO_LONG',
      message: 'First name too long (max 50 characters)',
      value: normalized.firstName
    });
  }
  
  if (normalized.lastName && normalized.lastName.length > 50) {
    errors.push({
      field: 'lastName',
      code: 'FIELD_TOO_LONG',
      message: 'Last name too long (max 50 characters)',
      value: normalized.lastName
    });
  }
  
  return errors;
};

// Parse file content
const parseFileContent = async (fileBuffer, mimeType, filename) => {
  return new Promise((resolve, reject) => {
    const rows = [];
    
    try {
      if (mimeType === 'text/csv') {
        const stream = Readable.from(fileBuffer.toString());
        stream
          .pipe(csv())
          .on('data', (row) => rows.push(row))
          .on('end', () => resolve(rows))
          .on('error', reject);
      } else if (mimeType.includes('sheet') || mimeType.includes('excel')) {
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        resolve(jsonData);
      } else if (mimeType === 'application/json') {
        const jsonData = JSON.parse(fileBuffer.toString());
        resolve(Array.isArray(jsonData) ? jsonData : [jsonData]);
      } else {
        reject(new Error('Unsupported file format'));
      }
    } catch (error) {
      reject(error);
    }
  });
};

// Controllers
const uploadFile = async (req, res) => {
  try {
    // Check if feature is enabled
    if (process.env.ENABLE_USER_IMPORT !== '1') {
      return res.status(403).json({
        success: false,
        message: 'User import feature is disabled'
      });
    }
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    const { cohort, requireReferralCode = false } = req.body;
    
    if (!cohort) {
      return res.status(400).json({
        success: false,
        message: 'Cohort is required'
      });
    }
    
    // Verificar que la cohorte existe y está activa
    const cohortData = await CohortService.getCohortByBatchId(cohort);
    if (!cohortData || !cohortData.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cohorte no encontrada o inactiva',
        code: 'INVALID_COHORT'
      });
    }
    
    // Upload file to GridFS
    const uploadStream = gridFSBucket.openUploadStream(req.file.originalname, {
      metadata: {
        uploadedBy: req.user.userId,
        uploadedAt: new Date(),
        cohort,
        mimeType: req.file.mimetype,
        size: req.file.size
      }
    });
    
    const fileId = uploadStream.id;
    
    uploadStream.end(req.file.buffer);
    
    await new Promise((resolve, reject) => {
      uploadStream.on('finish', resolve);
      uploadStream.on('error', reject);
    });
    
    // Create import job
    const job = new UserImportJob({
      cohort,
      source: fileId.toString(),
      sourceType: 'gridfs',
      originalFilename: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      createdBy: req.user.userId,
      options: {
        requireReferralCode: Boolean(requireReferralCode),
        allowDuplicateEmails: false,
        defaultRole: 'user',
        sendWelcomeEmail: false,
        autoActivate: true
      },
      metadata: {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      }
    });
    
    await job.save();
    
    res.status(201).json({
      success: true,
      data: {
        jobId: job.jobId,
        fileId: fileId.toString(),
        filename: req.file.originalname,
        size: req.file.size,
        cohort,
        status: job.status,
        createdAt: job.createdAt
      },
      message: 'File uploaded successfully. Use the run endpoint to start processing.'
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Upload failed',
      error: error.message
    });
  }
};

const runImport = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { dryRun = true, commit = false } = req.body; // Default to dry-run
    
    const job = await UserImportJob.findOne({ jobId });
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Import job not found'
      });
    }
    
    if (job.status !== 'queued') {
      return res.status(400).json({
        success: false,
        message: `Job is already ${job.status}`
      });
    }
    
    // Set execution mode
    const executionMode = commit ? 'commit' : 'dry-run';
    job.executionMode = executionMode;
    job.isDryRun = !commit;
    await job.save();
    
    // Acquire lock
    const workerId = `worker_${uuidv4().substring(0, 8)}`;
    await job.acquireLock(workerId);
    
    // Start processing (this would typically be done in a background job)
    processImportJob(job.jobId, workerId);
    
    res.json({
      success: true,
      data: {
        jobId: job.jobId,
        status: 'running',
        executionMode,
        message: executionMode === 'dry-run' ? 'Dry-run validation started' : 'Import processing started'
      }
    });
    
  } catch (error) {
    console.error('Run import error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start import',
      error: error.message
    });
  }
};

const getJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = await UserImportJob.findOne({ jobId });
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Import job not found'
      });
    }
    
    // Get row statistics
    const rowStats = await UserImportRow.getJobStatistics(jobId);
    
    res.json({
      success: true,
      data: {
        jobId: job.jobId,
        status: job.status,
        cohort: job.cohort,
        progress: job.progress,
        metrics: {
          totalRows: job.totalRows,
          validRows: job.validRows,
          invalidRows: job.invalidRows,
          importedRows: job.importedRows,
          skippedRows: job.skippedRows,
          successRate: job.successRate
        },
        timing: {
          createdAt: job.createdAt,
          startedAt: job.startedAt,
          finishedAt: job.finishedAt,
          duration: job.duration
        },
        errors: job.errors,
        rowStatistics: rowStats,
        isLocked: job.isLocked
      }
    });
    
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get job status',
      error: error.message
    });
  }
};

const getJobReport = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { format = 'json', includeErrors = 'true' } = req.query;
    
    const job = await UserImportJob.findOne({ jobId });
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Import job not found'
      });
    }
    
    // Get detailed row information
    const query = { jobId };
    if (includeErrors === 'false') {
      query.status = { $ne: 'invalid' };
    }
    
    const rows = await UserImportRow.find(query)
      .sort({ rowIndex: 1 })
      .populate('importResult.userId', 'email firstName lastName');
    
    const report = {
      job: {
        jobId: job.jobId,
        cohort: job.cohort,
        status: job.status,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        duration: job.duration
      },
      summary: {
        totalRows: job.totalRows,
        validRows: job.validRows,
        invalidRows: job.invalidRows,
        importedRows: job.importedRows,
        skippedRows: job.skippedRows,
        successRate: job.successRate
      },
      rows: rows.map(row => ({
        rowIndex: row.rowIndex,
        status: row.status,
        normalized: row.normalized,
        validationErrors: row.validationErrors,
        skipReason: row.skipReason,
        importResult: row.importResult,
        errorDetails: row.errorDetails
      }))
    };
    
    if (format === 'csv') {
      // Convert to CSV format
      const csvData = rows.map(row => ({
        rowIndex: row.rowIndex,
        status: row.status,
        email: row.normalized.email,
        firstName: row.normalized.firstName,
        lastName: row.normalized.lastName,
        errors: row.validationErrors.map(e => e.message).join('; '),
        skipReason: row.skipReason || '',
        imported: row.status === 'imported' ? 'Yes' : 'No'
      }));
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="import-report-${jobId}.csv"`);
      
      // Simple CSV conversion (in production, use a proper CSV library)
      const csvHeader = 'Row,Status,Email,First Name,Last Name,Errors,Skip Reason,Imported\n';
      const csvRows = csvData.map(row => 
        `${row.rowIndex},${row.status},${row.email || ''},${row.firstName || ''},${row.lastName || ''},"${row.errors}",${row.skipReason},${row.imported}`
      ).join('\n');
      
      res.send(csvHeader + csvRows);
    } else {
      res.json({
        success: true,
        data: report
      });
    }
    
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
};

const listJobs = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      cohort,
      createdBy 
    } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (cohort) query.cohort = cohort;
    if (createdBy) query.createdBy = createdBy;
    
    const jobs = await UserImportJob.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('createdBy', 'email firstName lastName');
    
    const total = await UserImportJob.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        jobs: jobs.map(job => ({
          jobId: job.jobId,
          cohort: job.cohort,
          status: job.status,
          progress: job.progress,
          metrics: {
            totalRows: job.totalRows,
            importedRows: job.importedRows,
            successRate: job.successRate
          },
          createdAt: job.createdAt,
          startedAt: job.startedAt,
          finishedAt: job.finishedAt,
          createdBy: job.createdBy
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('List jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list jobs',
      error: error.message
    });
  }
};

// Background processing function
const processImportJob = async (jobId, workerId) => {
  try {
    const job = await UserImportJob.findOne({ jobId });
    if (!job) return;
    
    // Idempotency check: if job was already processed, skip reprocessing
    const existingRows = await UserImportRow.countDocuments({ jobId });
    if (existingRows > 0 && job.status !== 'pending') {
      console.log(`Job ${jobId} already has ${existingRows} processed rows, skipping reprocessing`);
      return;
    }
    
    job.status = 'running';
    job.startedAt = new Date();
    await job.save();
    
    // Download file from GridFS
    const downloadStream = gridFSBucket.openDownloadStream(new mongoose.Types.ObjectId(job.source));
    const chunks = [];
    
    downloadStream.on('data', chunk => chunks.push(chunk));
    downloadStream.on('end', async () => {
      try {
        const fileBuffer = Buffer.concat(chunks);
        const rows = await parseFileContent(fileBuffer, job.mimeType, job.originalFilename);
        
        job.totalRows = rows.length;
        await job.save();
        
        // Process rows in chunks
        const chunkSize = job.chunkSize;
        let validCount = 0;
        let invalidCount = 0;
        let importedCount = 0;
        let skippedCount = 0;
        
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          
          for (let j = 0; j < chunk.length; j++) {
            const rowIndex = i + j;
            const rawData = chunk[j];
            
            // Create import row
            const importRow = new UserImportRow({
              jobId,
              rowIndex,
              raw: rawData
            });
            
            // Normalize data
            importRow.normalized = normalizeUserData(rawData);
            importRow.generateDedupKey();
            
            // Validate data
            const validationErrors = await validateUserData(
              importRow.normalized, 
              job.options.requireReferralCode
            );
            
            if (validationErrors.length > 0) {
              validationErrors.forEach(error => {
                importRow.addValidationError(error.field, error.code, error.message, error.value);
              });
              invalidCount++;
            } else {
              importRow.markValid();
              validCount++;
              
              // Try to import user (or simulate in dry-run mode)
              try {
                if (job.isDryRun) {
                  // Dry-run mode: validate without creating users
                  
                  // Check for existing user with same email
                  const existingUser = await User.findOne({ email: importRow.normalized.email });
                  if (existingUser) {
                    await importRow.markSkipped('USER_ALREADY_EXISTS', 'User with this email already exists');
                    skippedCount++;
                  } else {
                    // Simulate successful import
                    await importRow.markValid();
                    importRow.status = 'validated';
                    importedCount++; // Count as "would be imported"
                  }
                } else {
                  // Commit mode: actually create users
                  const userData = {
                    email: importRow.normalized.email,
                    firstName: importRow.normalized.firstName,
                    lastName: importRow.normalized.lastName,
                    phone: importRow.normalized.phone,
                    referralCode: importRow.normalized.referralCode,
                    referredBy: importRow.normalized.referredBy,
                    cohort: importRow.normalized.cohort || job.cohort,
                    role: importRow.normalized.role,
                    isActive: importRow.normalized.isActive,
                    password: 'temp_password_' + Math.random().toString(36).substring(7), // Temporary password
                    isEmailVerified: false
                  };
                  
                  const newUser = new User(userData);
                  await newUser.save();
                  
                  await importRow.markImported(newUser._id);
                  importedCount++;
                }
              } catch (importError) {
                if (importError.code === 11000) {
                  // Duplicate key error
                  await importRow.markSkipped('USER_ALREADY_EXISTS', 'User with this email already exists');
                  skippedCount++;
                } else {
                  await importRow.markFailed(importError);
                  invalidCount++;
                }
              }
            }
            
            await importRow.save();
            
            // Update progress
            if ((rowIndex + 1) % 100 === 0) {
              await job.updateProgress(rowIndex + 1, 10); // Rough estimate of 10 rows/second
            }
          }
        }
        
        // Mark job as completed
        await job.markCompleted({
          validRows: validCount,
          invalidRows: invalidCount,
          importedRows: importedCount,
          skippedRows: skippedCount
        });
        
      } catch (processingError) {
        await job.markFailed('Processing failed', processingError.message);
      }
    });
    
    downloadStream.on('error', async (error) => {
      await job.markFailed('File download failed', error.message);
    });
    
  } catch (error) {
    console.error('Process import job error:', error);
  }
};

module.exports = {
  upload,
  uploadFile,
  runImport,
  getJobStatus,
  getJobReport,
  listJobs,
  processImportJob
};