/**
 * Configuración centralizada de comisiones
 * Sistema simplificado: solo comisión directa y comisión padre
 */

const COMMISSIONS = Object.freeze({
  // Comisión directa (referido directo)
  DIRECT_PERCENT: 0.10,         // 10%
  DIRECT_UNLOCK_DAYS: 9,        // Se desbloquea en 9 días
  
  // Comisión padre (primera activación)
  PARENT_PERCENT: 0.10,         // 10%
  PARENT_UNLOCK_DAYS: 17,       // Se desbloquea en 17 días
});

module.exports = {
  COMMISSIONS
};