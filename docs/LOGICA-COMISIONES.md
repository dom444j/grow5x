# 💸 Lógica de Comisiones — MVP (Normativa)

🚨 **DOCUMENTO ÚNICO VÁLIDO PARA COMISIONES Y REFERIDOS** 🚨

⚠️ **ADVERTENCIA IMPORTANTE** ⚠️
- Este documento contiene la ÚNICA información válida sobre el sistema de comisiones
- NO EXISTE ningún bono de $500 USD
- NO EXISTE ningún "assignment_bonus"
- CUALQUIER otra información que contradiga este documento ES FALSA

## 1) Definiciones
- **Direct Referral**: 10% sobre **valor de la venta** (no sobre beneficio). `unlockedAt = D+9`.
- **Padre**: 10% sobre **valor de la venta** (único por activación). `unlockedAt = D+17`.


## 2) Reglas
- Una sola comisión **Padre** por usuario activado (no por recompras).
- Direct Referral se **reactiva** con compras nuevas del mismo referido (cada `purchase`).
- Estados: `pending` → `available` (al llegar `unlockedAt`) → `paid`.
- Prevención de duplicados: llave lógica (`commissionType + fromUserId + purchase`).

## 3) Cálculo
```js
const base = purchase.amount; // USDT
const directReferral = base * 0.10; // unlock D+9
const parentBonus    = base * 0.10; // unlock D+17 (único por usuario)
```

## 4) Liberación
- Job diario `unlock-commissions.cron.js`:
  - `find({status:'pending', unlockedAt:{$lte: now}})` → `status='available'` y sumar a `balances.available`.

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

| Licencia | Precio (USDT) | Cashback Diario | Potencial Total | Procesamiento |
|----------|---------------|-----------------|-----------------|---------------|
| Starter | $50 | $6.25 | $250 (500%) | 24 horas |
| Basic | $100 | $12.50 | $500 (500%) | 12 horas |
| Standard | $250 | $31.25 | $1,250 (500%) | 6 horas |
| Premium | $500 | $62.50 | $2,500 (500%) | 3 horas |
| Gold | $1,000 | $125 | $5,000 (500%) | 1 hora |
