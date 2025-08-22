const Wallet = require('../models/Wallet');

/**
 * Servicio de pool de wallets con rotación LRS (Least Recently Shown) sin locks
 */
class WalletPoolService {
  /**
   * Selecciona una wallet del pool usando rotación LRS sin locks
   * @param {Object} params - Parámetros de selección
   * @param {string} params.userId - ID del usuario
   * @param {number} params.amountUSDT - Cantidad en USDT
   * @param {string} params.network - Red (default: 'BEP20')
   * @param {string} params.currency - Moneda (default: 'USDT')
   * @returns {Promise<Object>} - {address, network, currency}
   */
  async pick({ userId, amountUSDT, network = 'BEP20', currency = 'USDT' }) {
    const now = new Date();

    // Buscar wallet disponible usando LRS (Least Recently Shown)
    // Ordena por: shownCount ASC, lastShownAt ASC, _id ASC
    const wallet = await Wallet.findOneAndUpdate(
      {
        status: 'AVAILABLE',
        isActive: true,
        network,
        currency
      },
      {
        $set: {
          lastShownAt: now
        },
        $inc: {
          shownCount: 1
        }
      },
      {
        sort: {
          shownCount: 1,
          lastShownAt: 1,
          _id: 1
        },
        new: true
      }
    ).lean();

    if (!wallet) {
      throw new Error('NO_WALLETS_AVAILABLE');
    }

    return {
      address: wallet.address,
      network: wallet.network,
      currency: wallet.currency
    };
  }

  /**
   * Método legacy para compatibilidad - redirige a pick()
   * @deprecated Usar pick() en su lugar
   */
  async assign(params) {
    console.warn('[WalletPool] assign() is deprecated, use pick() instead');
    return this.pick(params);
  }

  /**
   * Método legacy - ya no se usan locks en Pool V2
   * @deprecated Los locks han sido eliminados en Pool V2
   */
  async releaseExpiredLocks() {
    console.warn('[WalletPool] releaseExpiredLocks() is deprecated - no locks in Pool V2');
    return 0;
  }

  /**
   * Método legacy - ya no se usan locks en Pool V2
   * @deprecated Los locks han sido eliminados en Pool V2
   */
  async releaseWallet(address) {
    console.warn('[WalletPool] releaseWallet() is deprecated - no locks in Pool V2');
    return false;
  }

  /**
   * Obtiene estadísticas del pool V2 (LRS sin locks)
   * @param {string} network - Red (default: 'BEP20')
   * @param {string} currency - Moneda (default: 'USDT')
   * @returns {Promise<Object>} - Estadísticas del pool
   */
  async getPoolStats(network = 'BEP20', currency = 'USDT') {
    const stats = await Wallet.aggregate([
      {
        $match: {
          network,
          currency,
          isActive: true
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalShown: { $sum: '$shownCount' }
        }
      }
    ]);

    const result = {
      AVAILABLE: 0,
      DISABLED: 0,
      total: 0,
      totalShown: 0
    };

    stats.forEach(stat => {
      result[stat._id] = stat.count;
      result.total += stat.count;
      result.totalShown += stat.totalShown || 0;
    });

    // Información adicional sobre rotación LRS
    const leastShown = await Wallet.findOne(
      { status: 'AVAILABLE', isActive: true, network, currency },
      { shownCount: 1, lastShownAt: 1 },
      { sort: { shownCount: 1, lastShownAt: 1, _id: 1 } }
    ).lean();

    const mostShown = await Wallet.findOne(
      { status: 'AVAILABLE', isActive: true, network, currency },
      { shownCount: 1, lastShownAt: 1 },
      { sort: { shownCount: -1, lastShownAt: -1, _id: -1 } }
    ).lean();

    if (leastShown) {
      result.leastShownCount = leastShown.shownCount || 0;
      result.leastShownAt = leastShown.lastShownAt;
    }

    if (mostShown) {
      result.mostShownCount = mostShown.shownCount || 0;
      result.mostShownAt = mostShown.lastShownAt;
    }

    return result;
  }

  /**
   * Verifica la salud del pool V2 (LRS sin locks)
   * @returns {Promise<Object>} - Estado de salud
   */
  async checkHealth() {
    const stats = await this.getPoolStats();
    
    // Verificar si hay wallets disponibles
    const hasAvailableWallets = stats.AVAILABLE > 0;
    
    const health = {
      status: 'healthy',
      available: stats.AVAILABLE,
      disabled: stats.DISABLED,
      total: stats.total,
      totalShown: stats.totalShown,
      leastShownCount: stats.leastShownCount,
      mostShownCount: stats.mostShownCount,
      rotationBalance: stats.mostShownCount - stats.leastShownCount,
      issues: []
    };
    
    // Detectar problemas
    if (!hasAvailableWallets) {
      health.status = 'critical';
      health.issues.push('NO_AVAILABLE_WALLETS');
    }
    
    if (stats.AVAILABLE < 3) {
      health.status = health.status === 'critical' ? 'critical' : 'warning';
      health.issues.push('LOW_AVAILABLE_WALLETS');
    }
    
    // Verificar balance de rotación LRS
    if (health.rotationBalance > 10) {
      health.status = health.status === 'critical' ? 'critical' : 'warning';
      health.issues.push('UNBALANCED_ROTATION');
    }
    
    return health;
  }


}

module.exports = new WalletPoolService();