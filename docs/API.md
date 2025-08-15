# 🔌 API — Endpoints MVP

## Auth
- POST `/api/auth/register` — {name,email,password,referralCode}
- POST `/api/auth/login` — {email,password}
- GET  `/api/me` — perfil y balances

## Catálogo
- GET `/api/packages`

## Pagos / Compras
- POST `/api/payments/submit` — {packageId} → asigna wallet BEP20 aleatoria, crea purchase+transaction (30min)
- POST `/api/payments/confirm-hash` — {purchaseId, txHash}
- POST `/api/admin/payments/confirm` — {purchaseId}

## Beneficios/Comisiones
- GET `/api/me/purchases`
- GET `/api/me/benefits`
- GET `/api/me/commissions`

## Retiros
- POST `/api/me/withdrawals` — {amount,address,network:'BEP20', pin}
- GET `/api/me/withdrawals`
- POST `/api/admin/withdrawals/:id/approve`
- POST `/api/admin/withdrawals/:id/complete`
- POST `/api/admin/withdrawals/:id/reject`

## Reportes
- GET `/api/admin/reports/summary`

## Health
- GET `/api/health`
- GET `/api/admin/health`
