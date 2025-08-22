const mongoose = require('mongoose');
const { User, Package, Purchase, Wallet, Commission, BenefitSchedule, Ledger, Withdrawal, Transaction } = require('../models');

/**
 * Dual Database Configuration
 * Allows switching between MongoDB Atlas and Local MongoDB
 * Maintains data synchronization between both databases
 */

class DualDatabaseManager {
  constructor() {
    this.atlasConnection = null;
    this.localConnection = null;
    this.currentConnection = 'atlas'; // 'atlas' or 'local'
    this.syncEnabled = false;
    
    // Database URIs
    this.atlasUri = process.env.MONGODB_URI || 'mongodb+srv://grow5x_app_prod:iPpu5woSkIYiqh2S@grow5x-pro.ompwduk.mongodb.net/grow5x?retryWrites=true&w=majority&appName=grow5x-pro';
    this.localUri = process.env.MONGODB_LOCAL_URI || 'mongodb://localhost:27017/grow5x';
    
    // Model instances for each connection
    this.atlasModels = {};
    this.localModels = {};
  }
  
  /**
   * Initialize both database connections
   */
  async initialize() {
    try {
      console.log('🔄 Inicializando conexiones duales...');
      
      // Connect to Atlas
      console.log('🌐 Conectando a MongoDB Atlas...');
      this.atlasConnection = await mongoose.createConnection(this.atlasUri);
      console.log('✅ Conectado a Atlas: grow5x-pro.ompwduk.mongodb.net');
      
      // Connect to Local
      console.log('🏠 Conectando a MongoDB Local...');
      try {
        this.localConnection = await mongoose.createConnection(this.localUri);
        console.log('✅ Conectado a Local: localhost:27017/grow5x');
      } catch (localError) {
        console.log('⚠️  MongoDB Local no disponible:', localError.message);
        console.log('💡 Para usar modo dual, instala MongoDB localmente');
      }
      
      // Create model instances for both connections
      this.createModelInstances();
      
      console.log('🎉 Configuración dual completada');
      
    } catch (error) {
      console.error('❌ Error inicializando conexiones duales:', error.message);
      throw error;
    }
  }
  
  /**
   * Create model instances for both connections
   */
  createModelInstances() {
    const modelSchemas = {
      User: User.schema,
      Package: Package.schema,
      Purchase: Purchase.schema,
      Wallet: Wallet.schema,
      Commission: Commission.schema,
      BenefitSchedule: BenefitSchedule.schema,
      Ledger: Ledger.schema,
      Withdrawal: Withdrawal.schema,
      Transaction: Transaction.schema
    };
    
    // Atlas models
    for (const [modelName, schema] of Object.entries(modelSchemas)) {
      this.atlasModels[modelName] = this.atlasConnection.model(modelName, schema);
    }
    
    // Local models (if connection exists)
    if (this.localConnection) {
      for (const [modelName, schema] of Object.entries(modelSchemas)) {
        this.localModels[modelName] = this.localConnection.model(modelName, schema);
      }
    }
  }
  
  /**
   * Get current active models based on selected connection
   */
  getModels() {
    if (this.currentConnection === 'atlas') {
      return this.atlasModels;
    } else if (this.currentConnection === 'local' && this.localConnection) {
      return this.localModels;
    } else {
      console.warn('⚠️  Local connection not available, falling back to Atlas');
      return this.atlasModels;
    }
  }
  
  /**
   * Switch between Atlas and Local databases
   */
  switchTo(connectionType) {
    if (connectionType === 'local' && !this.localConnection) {
      console.warn('⚠️  MongoDB Local no disponible, manteniendo Atlas');
      return false;
    }
    
    this.currentConnection = connectionType;
    console.log(`🔄 Cambiado a: ${connectionType === 'atlas' ? 'MongoDB Atlas' : 'MongoDB Local'}`);
    return true;
  }
  
  /**
   * Get current connection info
   */
  getCurrentConnection() {
    return {
      type: this.currentConnection,
      atlas: {
        connected: !!this.atlasConnection,
        uri: this.atlasUri.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@')
      },
      local: {
        connected: !!this.localConnection,
        uri: this.localUri
      }
    };
  }
  
  /**
   * Enable/disable automatic synchronization
   */
  setSyncEnabled(enabled) {
    this.syncEnabled = enabled;
    console.log(`🔄 Sincronización automática: ${enabled ? 'ACTIVADA' : 'DESACTIVADA'}`);
  }
  
  /**
   * Synchronize data from Atlas to Local
   */
  async syncAtlasToLocal() {
    if (!this.localConnection) {
      console.warn('⚠️  MongoDB Local no disponible para sincronización');
      return false;
    }
    
    try {
      console.log('🔄 Sincronizando Atlas → Local...');
      
      const collections = ['User', 'Package', 'Wallet', 'Purchase', 'Commission', 'BenefitSchedule', 'Ledger', 'Withdrawal', 'Transaction'];
      
      for (const collection of collections) {
        const atlasData = await this.atlasModels[collection].find({}).lean();
        
        if (atlasData.length > 0) {
          // Clear local collection
          await this.localModels[collection].deleteMany({});
          
          // Insert Atlas data
          await this.localModels[collection].insertMany(atlasData);
          
          console.log(`  ✅ ${collection}: ${atlasData.length} documentos`);
        }
      }
      
      console.log('🎉 Sincronización Atlas → Local completada');
      return true;
      
    } catch (error) {
      console.error('❌ Error sincronizando Atlas → Local:', error.message);
      return false;
    }
  }
  
  /**
   * Synchronize data from Local to Atlas
   */
  async syncLocalToAtlas() {
    if (!this.localConnection) {
      console.warn('⚠️  MongoDB Local no disponible para sincronización');
      return false;
    }
    
    try {
      console.log('🔄 Sincronizando Local → Atlas...');
      
      const collections = ['User', 'Package', 'Wallet', 'Purchase', 'Commission', 'BenefitSchedule', 'Ledger', 'Withdrawal', 'Transaction'];
      
      for (const collection of collections) {
        const localData = await this.localModels[collection].find({}).lean();
        
        if (localData.length > 0) {
          // Clear Atlas collection
          await this.atlasModels[collection].deleteMany({});
          
          // Insert Local data
          await this.atlasModels[collection].insertMany(localData);
          
          console.log(`  ✅ ${collection}: ${localData.length} documentos`);
        }
      }
      
      console.log('🎉 Sincronización Local → Atlas completada');
      return true;
      
    } catch (error) {
      console.error('❌ Error sincronizando Local → Atlas:', error.message);
      return false;
    }
  }
  
  /**
   * Get database statistics for both connections
   */
  async getStats() {
    const stats = {
      atlas: {},
      local: {}
    };
    
    const collections = ['User', 'Package', 'Wallet', 'Purchase', 'Commission', 'BenefitSchedule', 'Ledger', 'Withdrawal', 'Transaction'];
    
    // Atlas stats
    for (const collection of collections) {
      try {
        stats.atlas[collection] = await this.atlasModels[collection].countDocuments();
      } catch (error) {
        stats.atlas[collection] = 'Error';
      }
    }
    
    // Local stats (if available)
    if (this.localConnection) {
      for (const collection of collections) {
        try {
          stats.local[collection] = await this.localModels[collection].countDocuments();
        } catch (error) {
          stats.local[collection] = 'Error';
        }
      }
    } else {
      stats.local = 'No disponible';
    }
    
    return stats;
  }
  
  /**
   * Close all connections
   */
  async close() {
    try {
      if (this.atlasConnection) {
        await this.atlasConnection.close();
        console.log('🔌 Desconectado de Atlas');
      }
      
      if (this.localConnection) {
        await this.localConnection.close();
        console.log('🔌 Desconectado de Local');
      }
    } catch (error) {
      console.error('❌ Error cerrando conexiones:', error.message);
    }
  }
}

// Singleton instance
const dualDB = new DualDatabaseManager();

module.exports = {
  DualDatabaseManager,
  dualDB
};