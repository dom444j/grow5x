# 📱 Configuración de Telegram - Grow5X

## 📋 Credenciales del Bot

### Token del Bot
```
TELEGRAM_BOT_TOKEN=8439254005:AAGlWyC9XjXCIyeg5vBtv1WMzvpzqN4e5n4
```

### Chat ID Administrativo
```
TELEGRAM_ADMIN_CHAT_ID=8382640858
```

## 🔧 Configuración Adicional

### Enlace de Comunidad
```
TELEGRAM_COMMUNITY_LINK=https://t.me/grow5x_community
```

### Token Secreto para Webhooks
```
TELEGRAM_SECRET_TOKEN=grow5x_telegram_webhook_secret_2025
```

### URL del Webhook
```
TELEGRAM_WEBHOOK_URL=https://grow5x.app/api/webhooks/telegram
```

### Estado del Servicio
```
TELEGRAM_ENABLED=true
```

## 📍 Información del Bot

- **Nombre del Bot:** GrowX5 Activación Bot
- **Username:** @Grow5XBot
- **Estado:** ✅ Activo y configurado
- **Creado con:** @BotFather en Telegram

## ⚙️ Funcionalidades Implementadas

### 🔐 OTP para Retiros
- Envío automático de códigos PIN de 6 dígitos
- Expiración de 10 minutos
- Formato HTML con emojis y estilos
- Validación de chat ID
- Integración con sistema de retiros

### 📢 Notificaciones Administrativas
- Alertas de nuevos registros
- Confirmaciones de pagos
- Estados de retiros (aprobado, completado, rechazado)
- Notificaciones de sistema
- Envío automático al chat administrativo

### 🔗 Webhooks
- **Endpoint:** `/api/webhooks/telegram`
- Configuración automática de webhook
- Validación de token secreto
- Manejo de actualizaciones en tiempo real
- Rate limiting para seguridad (100 req/min)
- Comandos del bot: `/start`, `/help`, `/status`

### 🤖 Comandos del Bot

#### `/start`
- Mensaje de bienvenida
- Información sobre funcionalidades
- Enlace a la plataforma

#### `/help`
- Lista de comandos disponibles
- Descripción de funciones automáticas
- Enlaces útiles (plataforma y comunidad)

#### `/status`
- Estado del bot en tiempo real
- Información de configuración
- Última verificación

## 🛠️ Scripts de Gestión

### Configurar Webhook
```bash
npm run telegram:setup
```

### Verificar Estado
```bash
npm run telegram:status
```

### Eliminar Webhook
```bash
npm run telegram:delete
```

## 📊 Monitoreo y Logs

### Logs Disponibles
- Inicialización del servicio
- Envío de OTP y notificaciones
- Configuración de webhooks
- Errores y excepciones
- Actualizaciones recibidas

### Métricas de Estado
- Bot inicializado: ✅/❌
- Bot configurado: ✅/❌
- Webhook configurado: ✅/❌
- Chat admin configurado: ✅/❌
- Token secreto configurado: ✅/❌
- Servicio habilitado: ✅/❌

## 🔒 Seguridad

### Validaciones Implementadas
- Verificación de token secreto en webhooks
- Validación de formato de chat ID
- Rate limiting en endpoints
- Logs de intentos no autorizados
- Sanitización de mensajes

### Headers de Seguridad
- `X-Telegram-Bot-Api-Secret-Token` requerido
- Validación de origen de requests
- Protección contra ataques de fuerza bruta

## 🚀 Estado de Configuración

- ✅ **TELEGRAM_ENABLED=true** - Funcionalidades habilitadas
- ✅ **Bot configurado** para desarrollo y producción
- ✅ **Webhook configurado** para `https://grow5x.app/api/webhooks/telegram`
- ✅ **Sistema de activación** por Telegram implementado
- ✅ **Scripts de gestión** disponibles
- ✅ **Comandos interactivos** implementados
- ✅ **Monitoreo y logs** configurados
- ✅ **Todas las credenciales** están activas y listas para usar

## 🔄 Flujo de Trabajo

### Para Retiros
1. Usuario solicita retiro en la plataforma
2. Sistema genera OTP de 6 dígitos
3. Bot envía PIN al Telegram del usuario
4. Usuario ingresa PIN para confirmar retiro
5. Administrador recibe notificación
6. Usuario recibe confirmación de estado

### Para Administración
1. Eventos del sistema generan notificaciones
2. Bot envía alertas al chat administrativo
3. Administrador puede monitorear en tiempo real
4. Logs detallados para auditoría

## 📞 Soporte

- **Plataforma:** https://grow5x.app
- **Comunidad:** https://t.me/grow5x_community
- **Bot:** @Grow5XBot
- **Documentación:** Este archivo