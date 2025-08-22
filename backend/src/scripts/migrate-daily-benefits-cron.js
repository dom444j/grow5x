/**
 * Migration script to transition from daily-benefits.cron.js to daily-benefits-v2.cron.js
 * This script ensures a smooth transition without data loss or duplicate processing
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const DailyProcessingState = require('../models/DailyProcessingState');
const BenefitLedger = require('../models/BenefitLedger');
const JobState = require('../models/JobState');
const logger = require('../config/logger');

/**
 * Get current date in Bogota timezone
 * @returns {Date} Current date in Bogota timezone
 */
function getCurrentDateInBogota() {
  const now = new Date();
  const bogotaTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Bogota"}));
  return new Date(bogotaTime.getFullYear(), bogotaTime.getMonth(), bogotaTime.getDate());
}

/**
 * Migrate existing benefit processing history to DailyProcessingState
 * This helps maintain idempotency for already processed dates
 */
async function migrateProcessingHistory() {
  logger.info('Starting migration of daily benefits processing history...');
  
  try {
    // Get unique benefit dates from the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const processedDates = await BenefitLedger.aggregate([
      {
        $match: {
          type: 'DAILY_BENEFIT',
          benefitDate: { $gte: thirtyDaysAgo },
          processed: true
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$benefitDate",
              timezone: "America/Bogota"
            }
          },
          totalBenefits: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          firstProcessed: { $min: "$createdAt" },
          lastProcessed: { $max: "$createdAt" }
        }
      },
      {
        $sort: { _id: -1 }
      }
    ]);
    
    logger.info(`Found ${processedDates.length} dates with processed benefits`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const dateData of processedDates) {
      const processDate = dateData._id;
      
      // Check if already exists in DailyProcessingState
      const existingState = await DailyProcessingState.getProcessingState(processDate);
      
      if (existingState) {
        logger.debug(`Processing state already exists for ${processDate}`);
        skippedCount++;
        continue;
      }
      
      // Create processing state for this date
      await DailyProcessingState.create({
        processDate,
        status: 'completed',
        startedAt: dateData.firstProcessed,
        completedAt: dateData.lastProcessed,
        stats: {
          totalPurchases: dateData.totalBenefits, // Approximation
          processedPurchases: dateData.totalBenefits,
          skippedPurchases: 0,
          errorCount: 0,
          totalBenefitAmount: dateData.totalAmount,
          totalCommissionAmount: 0, // Will be calculated separately if needed
          durationMs: dateData.lastProcessed.getTime() - dateData.firstProcessed.getTime()
        },
        metadata: {
          timezone: 'America/Bogota',
          cronVersion: 'v1-migrated',
          manualTrigger: false
        }
      });
      
      migratedCount++;
      logger.debug(`Migrated processing state for ${processDate}`);
    }
    
    logger.info('Migration completed', {
      migratedCount,
      skippedCount,
      totalProcessed: migratedCount + skippedCount
    });
    
    return {
      success: true,
      migratedCount,
      skippedCount
    };
    
  } catch (error) {
    logger.error('Error during migration:', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Validate that the migration was successful
 */
async function validateMigration() {
  logger.info('Validating migration...');
  
  try {
    const today = getCurrentDateInBogota();
    const todayStr = today.toISOString().split('T')[0];
    
    // Check if today's processing state exists
    const todayState = await DailyProcessingState.getProcessingState(todayStr);
    
    // Get recent processing states
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
    
    const recentStates = await DailyProcessingState.getProcessingStats(sevenDaysAgoStr, todayStr);
    
    logger.info('Migration validation results:', {
      todayProcessed: !!todayState,
      todayStatus: todayState?.status,
      recentStatesCount: recentStates.length,
      recentDates: recentStates.map(s => s.processDate)
    });
    
    return {
      success: true,
      todayProcessed: !!todayState,
      recentStatesCount: recentStates.length
    };
    
  } catch (error) {
    logger.error('Error during validation:', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    logger.info('Connected to MongoDB for migration');
    
    // Run migration
    const migrationResult = await migrateProcessingHistory();
    
    // Validate migration
    const validationResult = await validateMigration();
    
    logger.info('Migration completed successfully', {
      migration: migrationResult,
      validation: validationResult
    });
    
    return {
      success: true,
      migration: migrationResult,
      validation: validationResult
    };
    
  } catch (error) {
    logger.error('Migration failed:', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration()
    .then(result => {
      console.log('Migration completed:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error.message);
      process.exit(1);
    });
}

module.exports = {
  runMigration,
  migrateProcessingHistory,
  validateMigration
};