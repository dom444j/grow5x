const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    default: 'general',
    index: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Método estático para obtener configuración por clave
settingsSchema.statics.getValue = async function(key, defaultValue = null) {
  try {
    const setting = await this.findOne({ key, isActive: true }).lean();
    return setting ? setting.value : defaultValue;
  } catch (error) {
    console.error(`Error getting setting ${key}:`, error);
    return defaultValue;
  }
};

// Método estático para establecer configuración
settingsSchema.statics.setValue = async function(key, value, options = {}) {
  try {
    const updateData = {
      value,
      ...options
    };
    
    const setting = await this.findOneAndUpdate(
      { key },
      updateData,
      { upsert: true, new: true }
    );
    
    return setting;
  } catch (error) {
    console.error(`Error setting ${key}:`, error);
    throw error;
  }
};

// Método estático para obtener configuraciones por categoría
settingsSchema.statics.getByCategory = async function(category) {
  try {
    const settings = await this.find({ category, isActive: true }).lean();
    const result = {};
    settings.forEach(setting => {
      result[setting.key] = setting.value;
    });
    return result;
  } catch (error) {
    console.error(`Error getting settings for category ${category}:`, error);
    return {};
  }
};

// Método estático para obtener configuraciones de comisiones
settingsSchema.statics.getCommissionSettings = async function() {
  try {
    const settings = await this.getByCategory('commissions');
    
    // Valores por defecto si no existen en BD
    const defaults = {
      'commissions.direct_percent': 0.10,
      'commissions.parent_percent': 0.10,
      'commissions.direct_unlock_days': 9,
      'commissions.parent_unlock_days': 17
    };
    
    return {
      DIRECT_PERCENT: settings['commissions.direct_percent'] || defaults['commissions.direct_percent'],
      PARENT_PERCENT: settings['commissions.parent_percent'] || defaults['commissions.parent_percent'],
      DIRECT_UNLOCK_DAYS: settings['commissions.direct_unlock_days'] || defaults['commissions.direct_unlock_days'],
      PARENT_UNLOCK_DAYS: settings['commissions.parent_unlock_days'] || defaults['commissions.parent_unlock_days']
    };
  } catch (error) {
    console.error('Error getting commission settings:', error);
    // Retornar valores por defecto en caso de error
    return {
      DIRECT_PERCENT: 0.10,
      PARENT_PERCENT: 0.10,
      DIRECT_UNLOCK_DAYS: 9,
      PARENT_UNLOCK_DAYS: 17
    };
  }
};

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings;