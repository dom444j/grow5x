# 💸 Lógica de Comisiones — Sistema Simplificado

🚨 **DOCUMENTO ÚNICO VÁLIDO PARA COMISIONES Y REFERIDOS** 🚨

⚠️ **SISTEMA ACTUALIZADO - ENERO 2025** ⚠️
- Este documento contiene la ÚNICA información válida sobre el sistema de comisiones
- Sistema simplificado: SOLO 2 tipos de comisiones
- NO EXISTE sistema multinivel (eliminado)
- CUALQUIER otra información que contradiga este documento ES FALSA

## 1) Tipos de Comisiones

### 🎯 Direct Referral (Comisión Directa)
- **Porcentaje**: 10% sobre valor de la venta
- **Desbloqueo**: D+9 días
- **Frecuencia**: Se genera con cada compra del referido directo
- **Tipo**: `direct_referral`

### 👨‍👩‍👧‍👦 Parent Bonus (Comisión Padre)
- **Porcentaje**: 10% sobre valor de la venta
- **Desbloqueo**: D+17 días
- **Frecuencia**: SOLO en la primera activación del referido directo
- **Condición**: El referido directo NO debe tener compras previas completadas
- **Tipo**: `parent_bonus`

## 2) Reglas del Sistema

### ✅ Reglas Generales
- **Estados**: `pending` → `available` (al llegar `unlockedAt`) → `paid`
- **Moneda**: USDT
- **Base de cálculo**: Valor total de la compra (no sobre beneficios)
- **Prevención de duplicados**: Por tipo + usuario + compra

### 🔄 Reglas Específicas
- **Direct Referral**: Se reactiva con CADA nueva compra del mismo referido
- **Parent Bonus**: ÚNICA vez por referido (solo en su primera activación)
- **Requisitos**: Usuario referidor debe estar activo (`isActive: true`)

## 3) Cálculo de Comisiones

```js
// Configuración centralizada
const COMMISSIONS = {
  DIRECT_PERCENT: 10,        // 10%
  DIRECT_UNLOCK_DAYS: 9,     // D+9
  PARENT_PERCENT: 10,        // 10%
  PARENT_UNLOCK_DAYS: 17     // D+17
};

// Cálculo
const purchaseAmount = purchase.totalAmount; // USDT
const directCommission = purchaseAmount * 0.10; // unlock D+9
const parentCommission = purchaseAmount * 0.10; // unlock D+17 (solo primera vez)
```

## 4) Proceso de Liberación

### 🤖 Automatización
- **Cron Job**: `unlock-commissions.cron.js` (diario)
- **Query**: `{status:'pending', unlockDate:{$lte: now}}`
- **Acción**: `status='available'` + actualizar `balances.available`

### 📊 Estados de Comisión
1. **pending**: Comisión creada, esperando desbloqueo
2. **available**: Desbloqueada, disponible para retiro
3. **paid**: Pagada al usuario
4. **cancelled**: Cancelada (casos excepcionales)

## 5) Sistema de Beneficios Personales

**Beneficios Inmediatos al Adquirir una Licencia:**
- ✅ **Cashback del 100%** recuperado en 8 días (primer ciclo)
- ✅ **12.5% diario** sobre el monto invertido durante días activos
- ✅ **Beneficios adicionales del 400%** en los siguientes 4 ciclos
- ✅ **Total potencial: 500%** (100% cashback + 400% beneficios)
- ✅ **Duración total:** 45 días (5 ciclos de 9 días cada uno: 8 días activos + 1 día de pausa)

**Estructura de Ciclos:**
- **Ciclo 1 (Días 1-9):** Días 1-8 pago diario del 12.5% + Día 9 pausa
- **Ciclo 2 (Días 10-18):** Días 10-17 pago diario del 12.5% + Día 18 pausa
- **Ciclo 3 (Días 19-27):** Días 19-26 pago diario del 12.5% + Día 27 pausa
- **Ciclo 4 (Días 28-36):** Días 28-35 pago diario del 12.5% + Día 36 pausa
- **Ciclo 5 (Días 37-45):** Días 37-44 pago diario del 12.5% + Día 45 pausa

**Beneficios por Tipo de Licencia:**

| Licencia | Precio (USDT) | Cashback Diario | Potencial Total | Comisiones |
|----------|---------------|-----------------|-----------------|------------|
| Starter | $100 | $12.50 | $500 (500%) | Direct: $10 (D+9) + Parent: $10 (D+17) |
| Diamond | $500 | $62.50 | $2,500 (500%) | Direct: $50 (D+9) + Parent: $50 (D+17) |

## 6) Cambios Implementados (Enero 2025)

### 🔄 Migración del Sistema
- **Eliminado**: Sistema multinivel (5 niveles)
- **Implementado**: Sistema simplificado (2 tipos)
- **Archivos actualizados**:
  - `src/config/commissions.js` - Configuración centralizada
  - `src/models/Commission.js` - Modelo actualizado sin campo `level`
  - `src/routes/admin.js` - Nueva lógica `createCommissions()`
  - `scripts/seed-packages.js` - Paquetes sin `commissionRates`
  - `scripts/fix-commissions-single-level.js` - Script de limpieza

### 📋 Script de Migración
```bash
# Ejecutar para limpiar datos existentes
node scripts/fix-commissions-single-level.js

# Re-seed de paquetes
node scripts/seed-packages.js
```

### ⚠️ Notas Importantes
- Las comisiones existentes con `level > 1` serán eliminadas
- Solo se mantienen comisiones `direct_referral` y `parent_bonus`
- El campo `level` se elimina del modelo Commission
- Sistema más simple y eficiente
