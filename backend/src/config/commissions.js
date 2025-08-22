/**
 * Configuración centralizada de comisiones
 * Sistema simplificado: solo comisión directa y comisión padre
 * Ahora lee desde la base de datos (Settings collection)
 */

const Settings = require('../models/Settings');

// Valores por defecto (fallback si no hay configuración en BD)
const DEFAULT_COMMISSIONS = Object.freeze({
  DIRECT_PERCENT: 0.10,         // 10%
  DIRECT_UNLOCK_DAYS: 9,        // Se desbloquea en D+9 días
  PARENT_PERCENT: 0.10,         // 10%
  PARENT_UNLOCK_DAYS: 17,       // Se desbloquea en D+17 días
});

// Cache para evitar consultas repetidas a BD
let commissionsCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Obtiene la configuración de comisiones desde BD con cache
 */
async function getCommissions() {
  try {
    // Verificar cache
    const now = Date.now();
    if (commissionsCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL) {
      return commissionsCache;
    }
    
    // Obtener desde BD
    const dbCommissions = await Settings.getCommissionSettings();
    
    // Actualizar cache
    commissionsCache = dbCommissions;
    cacheTimestamp = now;
    
    return dbCommissions;
  } catch (error) {
    console.error('Error loading commission settings from DB:', error);
    return DEFAULT_COMMISSIONS;
  }
}

/**
 * Configuración síncrona (usa cache o valores por defecto)
 * @deprecated Usar getCommissions() para obtener valores actualizados desde BD
 */
const COMMISSIONS = DEFAULT_COMMISSIONS;

/**
 * Invalida el cache de configuración
 */
function invalidateCache() {
  commissionsCache = null;
  cacheTimestamp = null;
}

module.exports = {
  COMMISSIONS,           // Para compatibilidad (valores por defecto)
  getCommissions,        // Función async que lee desde BD
  invalidateCache,       // Para invalidar cache cuando se actualice config
  DEFAULT_COMMISSIONS    // Valores por defecto
};