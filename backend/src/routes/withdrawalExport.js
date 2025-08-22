/**
 * Withdrawal Export/Import Routes
 * Administrative endpoints for external withdrawal processing
 */

const express = require('express');
const { z } = require('zod');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { adminLimiter } = require('../middleware/rateLimiter');
const { auditMiddleware, captureOriginalState } = require('../middleware/audit');
const { Withdrawal, User, AuditLog } = require('../models');
const { DecimalCalc } = require('../utils/decimal');
const logger = require('../config/logger');
const mongoose = require('mongoose');

const router = express.Router();

// Apply admin authentication and rate limiting to all routes
router.use(authenticateToken, requireAdmin, adminLimiter);

// Validation schemas
const importConfirmationsSchema = z.object({
  confirmations: z.array(z.object({
    withdrawalId: z.string().min(1, 'Withdrawal ID required'),
    status: z.enum(['completed', 'rejected'], 'Status must be completed or rejected'),
    txHash: z.string().optional(),
    errorMessage: z.string().optional(),
    processedAt: z.string().datetime().optional()
  })).min(1, 'At least one confirmation required')
});

/**
 * GET /api/admin/withdrawals/export
 * Export approved withdrawals for external processing
 */
router.get('/export', async (req, res) => {
  try {
    const { format = 'json', limit = 100 } = req.query;
    
    // Find approved withdrawals ready for processing
    const withdrawals = await Withdrawal.find({
      status: 'approved'
    })
    .populate('userId', 'email firstName lastName')
    .sort({ approvedAt: 1 })
    .limit(parseInt(limit))
    .lean();
    
    if (withdrawals.length === 0) {
      return res.json({
        success: true,
        message: 'No approved withdrawals found for export',
        data: {
          withdrawals: [],
          count: 0,
          exportedAt: new Date().toISOString()
        }
      });
    }
    
    // Transform data for external processing
    const exportData = withdrawals.map(withdrawal => ({
      withdrawalId: withdrawal.withdrawalId,
      userId: withdrawal.userId._id,
      userEmail: withdrawal.userId.email,
      userName: `${withdrawal.userId.firstName} ${withdrawal.userId.lastName}`,
      amount: withdrawal.amount.toString(),
      netAmount: withdrawal.netAmount.toString(),
      destinationAddress: withdrawal.destinationAddress,
      network: withdrawal.network,
      currency: withdrawal.currency,
      networkFee: withdrawal.networkFee.toString(),
      totalFees: withdrawal.totalFees.toString(),
      approvedAt: withdrawal.approvedAt,
      approvedBy: withdrawal.approvedBy,
      userNotes: withdrawal.userNotes,
      adminNotes: withdrawal.adminNotes,
      priority: withdrawal.priority
    }));
    
    // Log export action
    await AuditLog.logAction(
      req.user.userId,
      'withdrawal_export',
      null,
      'system',
      null,
      {
        count: withdrawals.length,
        withdrawalIds: withdrawals.map(w => w.withdrawalId)
      },
      {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        notes: `Exported ${withdrawals.length} approved withdrawals`
      }
    );
    
    logger.info('Withdrawals exported for processing', {
      adminId: req.user.userId,
      count: withdrawals.length,
      withdrawalIds: withdrawals.map(w => w.withdrawalId)
    });
    
    if (format === 'csv') {
      // Convert to CSV format
      const csvHeaders = [
        'withdrawalId', 'userEmail', 'userName', 'amount', 'netAmount',
        'destinationAddress', 'network', 'currency', 'networkFee', 'totalFees',
        'approvedAt', 'priority', 'userNotes', 'adminNotes'
      ];
      
      const csvRows = exportData.map(row => [
        row.withdrawalId,
        row.userEmail,
        row.userName,
        row.amount,
        row.netAmount,
        row.destinationAddress,
        row.network,
        row.currency,
        row.networkFee,
        row.totalFees,
        row.approvedAt,
        row.priority,
        `"${row.userNotes || ''}"`,
        `"${row.adminNotes || ''}"`
      ]);
      
      const csvContent = [csvHeaders.join(','), ...csvRows.map(row => row.join(','))].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="withdrawals_export_${Date.now()}.csv"`);
      return res.send(csvContent);
    }
    
    // Default JSON format
    res.json({
      success: true,
      message: `Successfully exported ${withdrawals.length} approved withdrawals`,
      data: {
        withdrawals: exportData,
        count: withdrawals.length,
        exportedAt: new Date().toISOString(),
        format: 'json'
      }
    });
    
  } catch (error) {
    logger.error('Error exporting withdrawals:', error);
    res.status(500).json({
      success: false,
      message: 'Error al exportar retiros',
      code: 'EXPORT_ERROR'
    });
  }
});

/**
 * POST /api/admin/withdrawals/import
 * Import withdrawal confirmations from external processing
 */
router.post('/import', async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    // Validate request body
    const validatedData = importConfirmationsSchema.parse(req.body);
    const { confirmations } = validatedData;
    
    const results = {
      processed: 0,
      errors: [],
      successful: [],
      skipped: []
    };
    
    await session.withTransaction(async () => {
      for (const confirmation of confirmations) {
        try {
          const { withdrawalId, status, txHash, errorMessage, processedAt } = confirmation;
          
          // Find the withdrawal
          const withdrawal = await Withdrawal.findOne({ withdrawalId }).session(session);
          
          if (!withdrawal) {
            results.errors.push({
              withdrawalId,
              error: 'Withdrawal not found'
            });
            continue;
          }
          
          // Check if withdrawal is in correct state
          if (withdrawal.status !== 'approved') {
            results.skipped.push({
              withdrawalId,
              reason: `Withdrawal status is ${withdrawal.status}, expected approved`
            });
            continue;
          }
          
          // Update withdrawal based on status
          if (status === 'completed') {
            if (!txHash) {
              results.errors.push({
                withdrawalId,
                error: 'Transaction hash required for completed status'
              });
              continue;
            }
            
            withdrawal.status = 'completed';
            withdrawal.txHash = txHash;
            withdrawal.completedAt = processedAt ? new Date(processedAt) : new Date();
            withdrawal.processedBy = req.user.userId;
            
          } else if (status === 'rejected') {
            withdrawal.status = 'rejected';
            withdrawal.rejectionReason = errorMessage || 'External processing failed';
            withdrawal.processedBy = req.user.userId;
            
            // Return funds to user balance
            const user = await User.findById(withdrawal.userId).session(session);
            if (user) {
              user.availableBalance = DecimalCalc.add(user.availableBalance, withdrawal.amount).toString();
              await user.save({ session });
            }
          }
          
          await withdrawal.save({ session });
          
          // Log the action
          await AuditLog.logAction(
            req.user.userId,
            'withdrawal_import_confirm',
            withdrawal._id,
            'Withdrawal',
            null,
            {
              withdrawalId,
              newStatus: status,
              txHash,
              errorMessage
            },
            {
              ip: req.ip,
              userAgent: req.get('User-Agent'),
              notes: `Imported confirmation: ${status}`
            }
          );
          
          results.successful.push({
            withdrawalId,
            status,
            txHash: txHash || null
          });
          results.processed++;
          
        } catch (error) {
          logger.error('Error processing withdrawal confirmation:', error);
          results.errors.push({
            withdrawalId: confirmation.withdrawalId,
            error: error.message
          });
        }
      }
    });
    
    logger.info('Withdrawal confirmations imported', {
      adminId: req.user.userId,
      totalConfirmations: confirmations.length,
      processed: results.processed,
      errors: results.errors.length,
      skipped: results.skipped.length
    });
    
    res.json({
      success: true,
      message: `Processed ${results.processed} of ${confirmations.length} confirmations`,
      data: results
    });
    
  } catch (error) {
    await session.abortTransaction();
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Datos de confirmación inválidos',
        code: 'VALIDATION_ERROR',
        errors: error.errors
      });
    }
    
    logger.error('Error importing withdrawal confirmations:', error);
    res.status(500).json({
      success: false,
      message: 'Error al importar confirmaciones de retiro',
      code: 'IMPORT_ERROR'
    });
  } finally {
    await session.endSession();
  }
});

/**
 * GET /api/admin/withdrawals/export/status
 * Get export/import statistics and status
 */
router.get('/export/status', async (req, res) => {
  try {
    const stats = await Withdrawal.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: { $toDouble: '$amount' } }
        }
      }
    ]);
    
    const statusMap = stats.reduce((acc, stat) => {
      acc[stat._id] = {
        count: stat.count,
        totalAmount: stat.totalAmount
      };
      return acc;
    }, {});
    
    // Get recent export activity
    const recentExports = await AuditLog.find({
      action: 'withdrawal_export'
    })
    .sort({ timestamp: -1 })
    .limit(10)
    .lean();
    
    res.json({
      success: true,
      data: {
        statusBreakdown: statusMap,
        pendingExport: statusMap.approved || { count: 0, totalAmount: 0 },
        recentExports: recentExports.map(exportRecord => ({
          exportedAt: exportRecord.timestamp,
          exportedBy: exportRecord.actorId,
          count: exportRecord.metadata?.count || 0
        }))
      }
    });
    
  } catch (error) {
    logger.error('Error getting export status:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estado de exportación',
      code: 'STATUS_ERROR'
    });
  }
});

module.exports = router;