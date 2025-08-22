/**
 * License Data Transfer Object
 * Standardizes license data structure for API responses
 */

const { toApiNumber } = require('../utils/decimal');

class LicenseDTO {
  /**
   * Create standardized license response for admin endpoints
   * @param {Object} license - License document from database
   * @param {Object} stats - Calculated license statistics
   * @param {Object} options - Additional options
   * @returns {Object} Standardized license DTO
   */
  static forAdmin(license, stats = {}, options = {}) {
    const dto = {
      _id: license._id?.toString() || license._id,
      licenseId: license.licenseId || license._id?.toString(),
      
      // User information
      user: license.userId ? {
        _id: license.userId._id?.toString() || license.userId._id,
        email: license.userId.email,
        firstName: license.userId.firstName,
        lastName: license.userId.lastName
      } : null,
      
      // Package information
      package: license.packageId ? {
        _id: license.packageId._id?.toString() || license.packageId._id,
        name: license.packageId.name,
        dailyRate: license.packageId.dailyRate
      } : null,
      
      // Purchase information
      purchaseId: license.purchaseId?._id?.toString() || license.purchaseId?.toString() || license.purchaseId,
      purchase: license.purchaseId ? {
        _id: license.purchaseId._id?.toString() || license.purchaseId._id,
        totalAmount: toApiNumber(license.purchaseId.totalAmount || 0),
        paymentAddress: license.purchaseId.paymentAddress,
        txHash: license.purchaseId.txHash,
        createdAt: license.purchaseId.createdAt?.toISOString() || license.purchaseId.createdAt
      } : null,
      
      // Financial data
      principalUSDT: toApiNumber(stats.principalUSDT || license.principalAmount || 0),
      accruedUSDT: toApiNumber(stats.accruedUSDT || stats.totalAccrued || 0),
      ganado: toApiNumber(stats.ganado || stats.earnedPct || 0),
      tope: toApiNumber(stats.tope || stats.capPct || 100),
      restanteUSDT: toApiNumber(stats.restanteUSDT || stats.remainingUSDT || 0),
      
      // Progress data
      daysGenerated: stats.daysGenerated || 0,
      progressPercent: toApiNumber(stats.progressPercent || 0),
      remainingDays: stats.remainingDays || 0,
      
      // Status and dates
      status: license.status,
      userFriendlyStatus: this.mapStatus(license.status),
      createdAt: license.createdAt?.toISOString() || license.createdAt,
      activatedAt: license.activatedAt?.toISOString() || license.activatedAt,
      completedAt: license.completedAt?.toISOString() || license.completedAt,
      
      // Wallet information
      walletAddress: stats.walletAddress || license.purchaseId?.paymentAddress,
      network: stats.network || license.purchaseId?.assignedWallet?.network || 'BEP20',
      paymentHash: stats.paymentHash || license.purchaseId?.txHash,
      
      // Admin fields
      adminNotes: license.adminNotes,
      completionReason: license.completionReason
    };
    
    // Remove null/undefined values
    return this.cleanDTO(dto);
  }
  
  /**
   * Create standardized license response for user endpoints
   * @param {Object} license - License document from database
   * @param {Object} stats - Calculated license statistics
   * @returns {Object} Standardized license DTO for users
   */
  static forUser(license, stats = {}) {
    const dto = {
      _id: license._id?.toString() || license._id,
      licenseId: license.licenseId || license._id?.toString(),
      
      // Package information (limited for users)
      packageName: license.packageId?.name || 'N/A',
      
      // Financial data
      principalAmount: toApiNumber(stats.principalUSDT || license.principalAmount || 0),
      accruedAmount: toApiNumber(stats.accruedUSDT || stats.totalAccrued || 0),
      dailyBenefitAmount: toApiNumber(license.dailyBenefitAmount || 0),
      remainingAmount: toApiNumber(stats.restanteUSDT || stats.remainingUSDT || 0),
      
      // Progress data
      totalDays: license.totalCycles * license.benefitDays || 40,
      daysGenerated: stats.daysGenerated || 0,
      remainingDays: stats.remainingDays || 0,
      progressPercent: toApiNumber(stats.progressPercent || 0),
      
      // Benefit progress
      benefitProgress: {
        currentCycle: Math.floor((stats.daysGenerated || 0) / 8) + 1,
        currentDay: ((stats.daysGenerated || 0) % 8) + 1,
        totalCycles: license.totalCycles || 5,
        benefitDays: license.benefitDays || 8,
        remainingDays: stats.remainingDays || 0,
        remainingCycles: Math.max(0, (license.totalCycles || 5) - Math.floor((stats.daysGenerated || 0) / 8))
      },
      
      // Status
      status: license.status,
      licenseStatus: this.mapStatus(license.status),
      
      // Dates
      createdAt: license.createdAt?.toISOString() || license.createdAt,
      activatedAt: license.activatedAt?.toISOString() || license.activatedAt
    };
    
    return this.cleanDTO(dto);
  }
  
  /**
   * Map license status to user-friendly status
   * @param {string} status - Raw license status
   * @returns {string} User-friendly status
   */
  static mapStatus(status) {
    const statusMap = {
      'ACTIVE': 'Activa',
      'PAUSED': 'Pausada',
      'COMPLETED': 'Completada',
      'PENDING': 'Pendiente',
      'CANCELLED': 'Cancelada'
    };
    
    return statusMap[status] || status;
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
        } else {
          cleaned[key] = value;
        }
      }
    }
    
    return cleaned;
  }
}

module.exports = LicenseDTO;