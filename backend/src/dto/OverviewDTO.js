/**
 * Overview Data Transfer Object
 * Standardizes dashboard and overview data structure for API responses
 */

const { toApiNumber } = require('../utils/decimal');
const PurchaseDTO = require('./PurchaseDTO');
const LicenseDTO = require('./LicenseDTO');

class OverviewDTO {
  /**
   * Create standardized overview response for user dashboard
   * @param {Object} data - Overview data from DashboardService
   * @returns {Object} Standardized overview DTO
   */
  static forUser(data) {
    const dto = {
      // User basic info
      user: {
        userId: data.user?.userId || data.user?._id?.toString(),
        email: data.user?.email,
        firstName: data.user?.firstName,
        lastName: data.user?.lastName,
        referralCode: data.user?.referralCode,
        isVerified: data.user?.isVerified || false
      },
      
      // Financial summary
      balances: {
        available: toApiNumber(data.balances?.available || 0),
        pending: toApiNumber(data.balances?.pending || 0),
        total: toApiNumber(data.balances?.total || 0)
      },
      
      // Investment summary
      investments: {
        totalInvested: toApiNumber(data.investments?.totalInvested || 0),
        totalAccrued: toApiNumber(data.investments?.totalAccrued || 0),
        activeLicenses: data.investments?.activeLicenses || 0,
        completedLicenses: data.investments?.completedLicenses || 0
      },
      
      // Recent purchases (last 5)
      recentPurchases: (data.recentPurchases || []).map(purchase => 
        PurchaseDTO.forOverview(purchase, purchase.licenseData)
      ),
      
      // Active licenses summary
      activeLicenses: (data.activeLicenses || []).map(license => 
        LicenseDTO.forUser(license, license.stats)
      ),
      
      // Commission summary
      commissions: {
        totalEarned: toApiNumber(data.commissions?.totalEarned || 0),
        pendingCommissions: toApiNumber(data.commissions?.pendingCommissions || 0),
        directReferrals: data.commissions?.directReferrals || 0,
        totalReferrals: data.commissions?.totalReferrals || 0
      },
      
      // Recent transactions (last 10)
      recentTransactions: (data.recentTransactions || []).map(transaction => ({
        _id: transaction._id?.toString() || transaction._id,
        type: transaction.type,
        amount: toApiNumber(transaction.amount || 0),
        status: transaction.status,
        description: transaction.description,
        createdAt: transaction.createdAt?.toISOString() || transaction.createdAt
      })),
      
      // Statistics
      stats: {
        totalPurchases: data.stats?.totalPurchases || 0,
        totalWithdrawals: data.stats?.totalWithdrawals || 0,
        averageDailyBenefit: toApiNumber(data.stats?.averageDailyBenefit || 0),
        memberSince: data.user?.createdAt?.toISOString() || data.user?.createdAt
      }
    };
    
    return this.cleanDTO(dto);
  }
  
  /**
   * Create standardized overview response for admin dashboard
   * @param {Object} data - Admin overview data
   * @returns {Object} Standardized admin overview DTO
   */
  static forAdmin(data) {
    const dto = {
      // Platform statistics
      platform: {
        totalUsers: data.platform?.totalUsers || 0,
        activeUsers: data.platform?.activeUsers || 0,
        verifiedUsers: data.platform?.verifiedUsers || 0,
        totalRevenue: toApiNumber(data.platform?.totalRevenue || 0),
        totalCommissionsPaid: toApiNumber(data.platform?.totalCommissionsPaid || 0)
      },
      
      // Purchase statistics
      purchases: {
        total: data.purchases?.total || 0,
        pending: data.purchases?.pending || 0,
        confirmed: data.purchases?.confirmed || 0,
        rejected: data.purchases?.rejected || 0,
        totalAmount: toApiNumber(data.purchases?.totalAmount || 0),
        todayCount: data.purchases?.todayCount || 0,
        todayAmount: toApiNumber(data.purchases?.todayAmount || 0)
      },
      
      // License statistics
      licenses: {
        active: data.licenses?.active || 0,
        paused: data.licenses?.paused || 0,
        completed: data.licenses?.completed || 0,
        totalPrincipal: toApiNumber(data.licenses?.totalPrincipal || 0),
        totalAccrued: toApiNumber(data.licenses?.totalAccrued || 0)
      },
      
      // Withdrawal statistics
      withdrawals: {
        pending: data.withdrawals?.pending || 0,
        approved: data.withdrawals?.approved || 0,
        completed: data.withdrawals?.completed || 0,
        rejected: data.withdrawals?.rejected || 0,
        totalAmount: toApiNumber(data.withdrawals?.totalAmount || 0)
      },
      
      // Recent activity
      recentPurchases: (data.recentPurchases || []).map(purchase => 
        PurchaseDTO.forAdmin(purchase)
      ),
      
      recentLicenses: (data.recentLicenses || []).map(license => 
        LicenseDTO.forAdmin(license, license.stats)
      ),
      
      // System health
      system: {
        status: data.system?.status || 'unknown',
        lastUpdate: data.system?.lastUpdate?.toISOString() || new Date().toISOString(),
        activeConnections: data.system?.activeConnections || 0,
        memoryUsage: data.system?.memoryUsage || 0
      }
    };
    
    return this.cleanDTO(dto);
  }
  
  /**
   * Create wallet overview for user
   * @param {Object} data - Wallet data
   * @returns {Object} Standardized wallet overview DTO
   */
  static forWallet(data) {
    const dto = {
      // Current balances
      balances: {
        available: toApiNumber(data.balances?.available || 0),
        pending: toApiNumber(data.balances?.pending || 0),
        total: toApiNumber(data.balances?.total || 0),
        dailyBenefits: toApiNumber(data.balances?.dailyBenefits || 0),
        commissions: toApiNumber(data.balances?.commissions || 0)
      },
      
      // Investment summary
      investments: {
        totalInvested: toApiNumber(data.investments?.totalInvested || 0),
        totalAccrued: toApiNumber(data.investments?.totalAccrued || 0),
        totalWithdrawn: toApiNumber(data.investments?.totalWithdrawn || 0),
        netProfit: toApiNumber((data.investments?.totalAccrued || 0) - (data.investments?.totalInvested || 0))
      },
      
      // Active licenses summary
      activeLicenses: (data.activeLicenses || []).map(license => ({
        _id: license._id?.toString() || license._id,
        packageName: license.packageName || 'N/A',
        principalAmount: toApiNumber(license.principalAmount || 0),
        accruedAmount: toApiNumber(license.accruedAmount || 0),
        progressPercent: toApiNumber(license.progressPercent || 0),
        remainingDays: license.remainingDays || 0,
        status: license.status
      })),
      
      // Recent transactions
      recentTransactions: (data.recentTransactions || []).map(transaction => ({
        _id: transaction._id?.toString() || transaction._id,
        type: transaction.type,
        amount: toApiNumber(transaction.amount || 0),
        status: transaction.status,
        description: transaction.description,
        createdAt: transaction.createdAt?.toISOString() || transaction.createdAt
      })),
      
      // Performance metrics
      performance: {
        averageDailyReturn: toApiNumber(data.performance?.averageDailyReturn || 0),
        totalReturnPercent: toApiNumber(data.performance?.totalReturnPercent || 0),
        daysActive: data.performance?.daysActive || 0,
        bestPerformingPackage: data.performance?.bestPerformingPackage || null
      }
    };
    
    return this.cleanDTO(dto);
  }
  
  /**
   * Remove null, undefined, and empty values from DTO
   * @param {Object} dto - DTO object to clean
   * @returns {Object} Cleaned DTO
   */
  static cleanDTO(dto) {
    const cleaned = {};
    
    for (const [key, value] of Object.entries(dto)) {
      if (value !== null && value !== undefined) {
        if (typeof value === 'object' && !Array.isArray(value)) {
          const cleanedNested = this.cleanDTO(value);
          if (Object.keys(cleanedNested).length > 0) {
            cleaned[key] = cleanedNested;
          }
        } else if (Array.isArray(value)) {
          const cleanedArray = value.map(item => 
            typeof item === 'object' ? this.cleanDTO(item) : item
          ).filter(item => item !== null && item !== undefined);
          if (cleanedArray.length > 0) {
            cleaned[key] = cleanedArray;
          }
        } else {
          cleaned[key] = value;
        }
      }
    }
    
    return cleaned;
  }
}

module.exports = OverviewDTO;