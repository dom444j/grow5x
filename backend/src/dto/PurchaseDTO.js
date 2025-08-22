/**
 * Purchase Data Transfer Object
 * Standardizes purchase data structure for API responses
 */

const { toApiNumber } = require('../utils/decimal');

class PurchaseDTO {
  /**
   * Create standardized purchase response for user endpoints
   * @param {Object} purchase - Purchase document from database
   * @param {Object} options - Additional options (license data, etc.)
   * @returns {Object} Standardized purchase DTO
   */
  static forUser(purchase, options = {}) {
    const dto = {
      _id: purchase._id?.toString() || purchase._id,
      purchaseId: purchase.purchaseId || purchase._id?.toString(),
      
      // Package information
      packageId: purchase.packageId?._id?.toString() || purchase.packageId?.toString() || purchase.packageId,
      package: purchase.packageId ? {
        _id: purchase.packageId._id?.toString() || purchase.packageId._id,
        name: purchase.packageId.name,
        price: toApiNumber(purchase.packageId.price || 0),
        dailyRate: purchase.packageId.dailyRate
      } : null,
      
      // Financial data
      amount: toApiNumber(purchase.totalAmount || purchase.amount || 0),
      amountUSDT: toApiNumber(purchase.totalAmount || purchase.amount || 0),
      totalAmount: toApiNumber(purchase.totalAmount || purchase.amount || 0),
      quantity: purchase.quantity || 1,
      
      // Payment information
      paymentHash: purchase.txHash || purchase.paymentHash,
      assignedWallet: purchase.assignedWallet ? {
        address: purchase.assignedWallet.address,
        network: purchase.assignedWallet.network || 'BEP20'
      } : null,
      paymentAddress: purchase.paymentAddress || purchase.assignedWallet?.address,
      network: purchase.assignedWallet?.network || 'BEP20',
      
      // Status and dates
      status: purchase.status,
      userFriendlyStatus: this.mapStatus(purchase.status),
      createdAt: purchase.createdAt?.toISOString() || purchase.createdAt,
      confirmedAt: purchase.confirmedAt?.toISOString() || purchase.confirmedAt,
      
      // License information (if available)
      licenseCreated: purchase.licenseCreated || false,
      licenseId: purchase.licenseId?.toString() || purchase.licenseId,
      
      // License progress data (if provided in options)
      ...options.licenseData
    };
    
    return this.cleanDTO(dto);
  }
  
  /**
   * Create standardized purchase response for admin endpoints
   * @param {Object} purchase - Purchase document from database
   * @param {Object} options - Additional options
   * @returns {Object} Standardized purchase DTO for admin
   */
  static forAdmin(purchase, options = {}) {
    const dto = {
      _id: purchase._id?.toString() || purchase._id,
      purchaseId: purchase.purchaseId || purchase._id?.toString(),
      
      // User information
      userId: purchase.userId?._id?.toString() || purchase.userId?.toString() || purchase.userId,
      user: purchase.userId ? {
        _id: purchase.userId._id?.toString() || purchase.userId._id,
        email: purchase.userId.email,
        firstName: purchase.userId.firstName,
        lastName: purchase.userId.lastName
      } : null,
      
      // Package information
      packageId: purchase.packageId?._id?.toString() || purchase.packageId?.toString() || purchase.packageId,
      package: purchase.packageId ? {
        _id: purchase.packageId._id?.toString() || purchase.packageId._id,
        name: purchase.packageId.name,
        price: toApiNumber(purchase.packageId.price || 0),
        dailyRate: purchase.packageId.dailyRate
      } : null,
      
      // Financial data
      amount: toApiNumber(purchase.totalAmount || purchase.amount || 0),
      totalAmount: toApiNumber(purchase.totalAmount || purchase.amount || 0),
      quantity: purchase.quantity || 1,
      
      // Payment information
      paymentHash: purchase.txHash || purchase.paymentHash,
      assignedWallet: purchase.assignedWallet ? {
        _id: purchase.assignedWallet._id?.toString() || purchase.assignedWallet._id,
        address: purchase.assignedWallet.address,
        network: purchase.assignedWallet.network || 'BEP20'
      } : null,
      paymentAddress: purchase.paymentAddress || purchase.assignedWallet?.address,
      
      // Status and dates
      status: purchase.status,
      userFriendlyStatus: this.mapStatus(purchase.status),
      createdAt: purchase.createdAt?.toISOString() || purchase.createdAt,
      confirmedAt: purchase.confirmedAt?.toISOString() || purchase.confirmedAt,
      submittedAt: purchase.submittedAt?.toISOString() || purchase.submittedAt,
      
      // License information
      licenseCreated: purchase.licenseCreated || false,
      licenseId: purchase.licenseId?.toString() || purchase.licenseId,
      
      // Admin fields
      adminNotes: purchase.adminNotes,
      confirmedBy: purchase.confirmedBy?.toString() || purchase.confirmedBy,
      rejectedBy: purchase.rejectedBy?.toString() || purchase.rejectedBy,
      rejectionReason: purchase.rejectionReason
    };
    
    return this.cleanDTO(dto);
  }
  
  /**
   * Create minimal purchase response for dashboard/overview
   * @param {Object} purchase - Purchase document from database
   * @param {Object} licenseData - Associated license data
   * @returns {Object} Minimal purchase DTO
   */
  static forOverview(purchase, licenseData = {}) {
    const dto = {
      _id: purchase._id?.toString() || purchase._id,
      purchaseId: purchase.purchaseId || purchase._id?.toString(),
      
      // Basic info
      packageName: purchase.packageId?.name || 'N/A',
      amount: toApiNumber(purchase.totalAmount || purchase.amount || 0),
      status: purchase.status,
      userFriendlyStatus: this.mapStatus(purchase.status),
      
      // Dates
      createdAt: purchase.createdAt?.toISOString() || purchase.createdAt,
      confirmedAt: purchase.confirmedAt?.toISOString() || purchase.confirmedAt,
      
      // License status
      licenseCreated: purchase.licenseCreated || false,
      licenseStatus: licenseData.licenseStatus || null,
      progressPercent: toApiNumber(licenseData.progressPercent || 0),
      remainingDays: licenseData.remainingDays || 0
    };
    
    return this.cleanDTO(dto);
  }
  
  /**
   * Map purchase status to user-friendly status
   * @param {string} status - Raw purchase status
   * @returns {string} User-friendly status
   */
  static mapStatus(status) {
    const statusMap = {
      'pending': 'Pendiente',
      'hash_submitted': 'Hash Enviado',
      'confirmed': 'Confirmada',
      'rejected': 'Rechazada',
      'cancelled': 'Cancelada'
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

module.exports = PurchaseDTO;