# 📄 Memoria Operativa Grow5X — MVP Estable

## 1️⃣ Flujo General del Sistema

1. **Registro de usuario**
   - Campos: `name`, `email`, `passwordHash`, `referralCode` (auto), `referredBy` (obligatorio), `role='user'`.
   - Validar que `referredBy` exista y esté activo.
   - Enviar mensaje de bienvenida vía **Telegram**.
   - Estado inicial: `verified=false`.

2. **Login**
   - Autenticación vía JWT en header.
   - Roles: `admin`, `user`.
   - Control de acceso a rutas según rol.

3. **Compra de licencia**
   - Usuario selecciona paquete → se asigna **wallet BEP20** aleatoria de pool activo.
   - Crear registro `purchase` con:
     ```
     { userId, packageId, amount, status:'pending', walletAssigned, expiresAt:+30min }
     ```
   - Mostrar modal de pago con QR y cuenta regresiva.
   - Usuario envía `txHash` → admin valida.
   - Si **confirmado**:
     - Activar licencia.
     - Iniciar ciclo de beneficios.
     - Generar comisión directa (si aplica).
     - Notificación Telegram.

4. **Sistema de beneficios**
   - 12.5% diario por 8 días → cashback 100%.
   - Día 9 pausa → segundo ciclo.
   - Día 17 → pago de **bonos especiales**.
   - Total 5 ciclos = 45 días.

5. **Retiros**
   - Monto mínimo: 50 USDT.
   - Solicitud genera **PIN a Telegram**.
   - Admin aprueba/rechaza → pago externo vía JSON.
   - Registro en `withdrawals`.

---

## 2️⃣ Estructura de Base de Datos (MongoDB Atlas)

**users**
```js
{
  _id,
  name,
  email,
  passwordHash,
  referralCode,
  referredBy,
  role,
  telegramId,
  balances: { available: Number, pending: Number },
  createdAt,
  updatedAt
}
```

**packages**
```js
{
  _id,
  name,
  price,
  dailyRate: 0.125,
  totalCycles: 5,
  activeDaysPerCycle: 8,
  pauseDaysPerCycle: 1,
  referralCommissionRate: 0.10,
  parentBonusRate: 0.05,
  leaderBonusRate: 0.05,
  createdAt,
  updatedAt
}
```

**wallets**
```js
{
  _id,
  address,
  network: 'BEP20',
  status: 'active'|'inactive',
  usageCount,
  lastUsed,
  createdAt
}
```

**purchases**
```js
{
  _id,
  userId,
  packageId,
  amount,
  walletAssigned,
  txHash,
  status: 'pending'|'confirmed'|'expired',
  expiresAt,
  createdAt,
  updatedAt
}
```

**benefits**
```js
{
  _id,
  userId,
  purchaseId,
  cycleNumber,
  dayNumber,
  amount,
  status: 'pending'|'paid',
  createdAt
}
```

**commissions**
```js
{
  _id,
  userId,
  fromUserId,
  type: 'direct_referral'|'parent_bonus'|'leader_bonus',
  amount,
  status: 'pending'|'paid',
  triggerDay,
  createdAt
}
```

**withdrawals**
```js
{
  _id,
  userId,
  amount,
  status: 'pending'|'approved'|'rejected'|'paid',
  pinCode,
  createdAt,
  updatedAt
}
```

---

## 3️⃣ Relaciones

- `users.referralCode` → `users.referredBy`
- `purchases.userId` → `users._id`
- `purchases.packageId` → `packages._id`
- `benefits.purchaseId` → `purchases._id`
- `commissions.userId` → `users._id`
- `commissions.fromUserId` → `users._id`
- `withdrawals.userId` → `users._id`

---

## 4️⃣ Procesos y Triggers

1. **Post confirmación de compra**
   - Activar licencia → Insertar beneficios iniciales (día 1).
   - Si `referredBy` existe:
     - Crear `commission` tipo `direct_referral` con estado `pending` y liberación día 9.
   - Si tiene código padre/líder:
     - Crear `commission` tipo `parent_bonus` / `leader_bonus` con estado `pending` y liberación día 17.

2. **Ciclo diario de beneficios**
   - Cron job → Generar beneficio diario 12.5%.
   - Cambiar estado a `paid` y mover a `balances.available`.

3. **Retiro**
   - Validar `balances.available >= 50`.
   - Generar `pinCode` → enviar a Telegram.
   - Admin cambia a `approved` → procesar pago externo.

---

## 5️⃣ Notificaciones y Seguridad

- **Telegram**: bienvenida, confirmación de pago, PIN de retiro.
- **Validaciones**:
  - `txHash` único por red.
  - Expiración de compras en 30 minutos.
  - Solo admin confirma pagos o retiros.
