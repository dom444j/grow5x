/**
 * License Data Mapper Service
 * Provides unified data mapping between admin and user license views
 * Ensures consistency across different endpoints
 */

const { BenefitLedger, License, Purchase } = require('../models');
const logger = require('../config/logger');

class LicenseDataMapper {
  /**
   * Calculate unified license statistics
   * Used by both admin and user endpoints
   */
  static async calculateLicenseStats(licenseId, principalAmount = null) {
    try {
      // Get benefit statistics
      const benefitStats = await BenefitLedger.aggregate([
        {
          $match: {
            licenseId: licenseId,
            type: 'DAILY_BENEFIT'
          }
        },
        {
          $group: {
            _id: null,
            totalAccrued: { $sum: '$amount' },
            daysGenerated: { $sum: 1 }
          }
        }
      ]);

      const stats = benefitStats[0] || { totalAccrued: 0, daysGenerated: 0 };
      const accruedUSDT = stats.totalAccrued;
      const daysGenerated = stats.daysGenerated;
      
      // Calculate progress metrics
      const maxDays = 40; // 8 days × 5 cycles
      const progressPercent = Math.round((daysGenerated / maxDays) * 100);
      const remainingDays = Math.max(0, maxDays - daysGenerated);
      
      // Calculate financial metrics
      const principal = principalAmount || 0;
      const ganado = principal > 0 ? (accruedUSDT / principal * 100) : 0;
      const tope = 100; // Default cap percentage
      const restanteUSDT = Math.max(0, (principal * tope / 100) - accruedUSDT);
      
      return {
        // Raw data
        principalUSDT: principal,
        accruedUSDT: Math.round(accruedUSDT * 100) / 100,
        daysGenerated,
        
        // Calculated metrics
        ganado: Math.round(ganado * 100) / 100,
        tope,
        restanteUSDT: Math.round(restanteUSDT * 100) / 100,
        progressPercent: Math.min(100, progressPercent),
        remainingDays,
        
        // Status indicators
        isCompleted: progressPercent >= 100,
        hasReachedCap: ganado >= tope
      };
    } catch (error) {
      logger.error('Error calculating license stats:', {
        licenseId,
        error: error.message
      });
      
      // Return safe defaults
      return {
        principalUSDT: principalAmount || 0,
        accruedUSDT: 0,
        daysGenerated: 0,
        ganado: 0,
        tope: 100,
        restanteUSDT: principalAmount || 0,
        progressPercent: 0,
        remainingDays: 40,
        isCompleted: false,
        hasReachedCap: false
      };
    }
  }

  /**
   * Map license status for user-friendly display
   */
  static mapLicenseStatus(licenseStatus) {
    const statusMap = {
      'ACTIVE': 'active',
      'PAUSED': 'paused', 
      'COMPLETED': 'completed',
      'CANCELLED': 'cancelled',
      'PENDING': 'pending'
    };
    
    return statusMap[licenseStatus] || 'pending';
  }

  /**
   * Enrich purchase data with license information for user endpoints
   */
  static async enrichPurchaseWithLicense(purchase) {
    let licenseData = {
      licenseStatus: null,
      progressPercent: 0,
      remainingDays: 0,
      benefitProgress: {
        currentCycle: 0,
        currentDay: 0,
        totalCycles: 5,
        benefitDays: 8,
        remainingDays: 0,
        remainingCycles: 5
      }
    };

    // Get license information if purchase has a license
    if (purchase.licenseCreated && purchase.licenseId) {
      try {
        const license = await License.findById(purchase.licenseId).lean();
        if (license) {
          const stats = await this.calculateLicenseStats(
            license._id, 
            license.principalAmount || purchase.totalAmount
          );
          
          licenseData = {
            licenseStatus: this.mapLicenseStatus(license.status),
            progressPercent: stats.progressPercent,
            remainingDays: stats.remainingDays,
            benefitProgress: {
              currentCycle: Math.floor(stats.daysGenerated / 8) + 1,
              currentDay: (stats.daysGenerated % 8) + 1,
              totalCycles: 5,
              benefitDays: 8,
              remainingDays: stats.remainingDays,
              remainingCycles: Math.max(0, 5 - Math.floor(stats.daysGenerated / 8))
            },
            // Additional fields for admin compatibility
            principalUSDT: stats.principalUSDT,
            accruedUSDT: stats.accruedUSDT,
            ganado: stats.ganado,
            tope: stats.tope,
            restanteUSDT: stats.restanteUSDT,
            daysGenerated: stats.daysGenerated
          };
        }
      } catch (error) {
        logger.error('Error enriching purchase with license data:', {
          purchaseId: purchase.purchaseId,
          error: error.message
        });
      }
    }

    return {
      ...purchase,
      ...licenseData
    };
  }

  /**
   * Enrich license data for admin endpoints
   */
  static async enrichLicenseForAdmin(license) {
    try {
      const principalAmount = license.principalAmount || 
                            license.purchaseId?.totalAmount || 
                            license.purchase?.totalAmount || 0;
      
      const stats = await this.calculateLicenseStats(license._id, principalAmount);
      
      // Extract wallet information from purchase
      let walletInfo = {};
      if (license.purchaseId) {
        const purchase = license.purchaseId;
        walletInfo = {
          walletAddress: purchase.paymentAddress || purchase.assignedWallet?.address,
          network: purchase.assignedWallet?.network || 'BEP20',
          paymentHash: purchase.txHash,
          purchaseId: purchase._id?.toString() || purchase._id
        };
      }
      
      return {
        ...license,
        ...stats,
        ...walletInfo,
        // Ensure user-friendly status mapping
        userFriendlyStatus: this.mapLicenseStatus(license.status)
      };
    } catch (error) {
      logger.error('Error enriching license for admin:', {
        licenseId: license._id,
        error: error.message
      });
      
      return license;
    }
  }

  /**
   * Get unified license data for dashboard
   */
  static async getDashboardLicenseData(userId) {
    try {
      const licenses = await License.find({ 
        userId, 
        status: { $in: ['ACTIVE', 'PAUSED', 'COMPLETED'] } 
      })
      .populate('purchaseId', 'totalAmount')
      .populate('packageId', 'name')
      .lean();

      const enrichedLicenses = await Promise.all(
        licenses.map(license => this.enrichLicenseForAdmin(license))
      );

      // Calculate summary stats
      const summary = {
        total: enrichedLicenses.length,
        active: enrichedLicenses.filter(l => l.status === 'ACTIVE').length,
        completed: enrichedLicenses.filter(l => l.status === 'COMPLETED').length,
        paused: enrichedLicenses.filter(l => l.status === 'PAUSED').length,
        totalPrincipal: enrichedLicenses.reduce((sum, l) => sum + l.principalUSDT, 0),
        totalAccrued: enrichedLicenses.reduce((sum, l) => sum + l.accruedUSDT, 0)
      };

      return {
        licenses: enrichedLicenses.slice(0, 3), // Top 3 for dashboard
        summary
      };
    } catch (error) {
      logger.error('Error getting dashboard license data:', {
        userId,
        error: error.message
      });
      
      return {
        licenses: [],
        summary: {
          total: 0,
          active: 0,
          completed: 0,
          paused: 0,
          totalPrincipal: 0,
          totalAccrued: 0
        }
      };
    }
  }
}

module.exports = LicenseDataMapper;