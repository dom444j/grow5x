# ✉️ Telegram — Bienvenida, PIN y Notificaciones

## Casos de uso
- **Bienvenida** al registrarse (si entrega `chatId`).
- **Confirmación de compra** (al activar licencia).
- **PIN de retiros** (OTP de 6 dígitos, válido 10 min).
- **Avisos** cuando una comisión pasa a `available`.

## Config
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ADMIN_CHAT_ID` (para alertas de sistema)

## Endpoints de servicio (interno)
- `TelegramService.sendWelcome(user)`
- `TelegramService.sendPurchaseConfirmed(user, purchase)`
- `TelegramService.sendWithdrawalPIN(user, pin)`
- `TelegramService.notifyCommissionAvailable(user, commission)`
