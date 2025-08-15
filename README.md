# Grow5X - Plataforma de Inversión

## 🚀 Estado del Proyecto: INTEGRACIÓN COMPLETADA

✅ **Backend Completo** - APIs, modelos, autenticación, sistema de comisiones, CRON jobs
✅ **Frontend Integrado** - Componentes conectados con backend, AuthContext, rutas protegidas
✅ **Sistema Funcional** - Registro, login, dashboard, compras, retiros, panel admin

## Estructura del Proyecto

```
grow5x/
├── frontend/          # React + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/    # Login, Register, Dashboard, Packages, Withdrawals, Admin
│   │   ├── contexts/      # AuthContext para manejo global de autenticación
│   │   ├── services/      # API services y utilidades
│   │   └── styles/        # Estilos Tailwind personalizados
├── backend/           # Node.js + Express + MongoDB Atlas
│   ├── src/
│   │   ├── models/        # Mongoose models (User, Package, Transaction, etc.)
│   │   ├── routes/        # API routes (auth, payments, admin, etc.)
│   │   ├── middleware/    # JWT auth, validation, error handling
│   │   ├── services/      # Business logic y servicios externos
│   │   └── cron/          # Procesadores automáticos de beneficios
│   └── scripts/       # Scripts de inicialización y seed data
└── README.md
```

## 🛠️ Funcionalidades Implementadas

### ✅ Sistema de Autenticación
- Registro con código de referido obligatorio
- Login con JWT tokens seguros
- Contexto global de autenticación (AuthContext)
- Rutas protegidas por rol (usuario/admin)

### ✅ Dashboard Interactivo
- Balance en tiempo real (available + pending)
- Código de referido único por usuario
- Estado de cuenta activa/inactiva
- Historial de transacciones

### ✅ Sistema de Licencias
- Catálogo de packages (Starter $100, Diamond $500)
- Proceso de compra con asignación automática de wallet
- Confirmación de hash de transacción
- Activación automática tras confirmación admin

### ✅ Sistema de Retiros
- Retiros mínimos de $50 USDT
- Validación OTP vía Telegram
- Estados: pending → approved → completed
- Panel de gestión para administradores

### ✅ Sistema de Comisiones
- Beneficios diarios automáticos (12.5% x 8 días, 5 ciclos)
- Comisiones de referido (10% directa, 5% indirecta)
- Procesamiento automático vía CRON jobs
- Desbloqueo programado (D+9, D+17)

### ✅ Panel Administrativo
- Gestión de usuarios y estadísticas
- Confirmación de pagos pendientes
- Aprobación/rechazo de retiros
- Ejecución manual de CRON jobs

## 🚀 Desarrollo

### Prerequisitos
- Node.js 18+
- MongoDB Atlas configurado
- Variables de entorno configuradas

### Frontend
```bash
cd frontend
npm install
npm run dev  # http://localhost:5173
```

### Backend
```bash
cd backend
npm install
npm run dev  # http://localhost:5000
```

### Inicialización de Datos
```bash
cd backend
npm run seed:admin     # Crear usuario admin
npm run seed:packages  # Crear licencias Starter/Diamond
npm run seed:wallets   # Crear pool de wallets BEP-20
```

## 🔧 Variables de Entorno

### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000/api  # Desarrollo
VITE_API_URL=https://grow5x.app/api     # Producción
```

### Backend (.env)
```env
# Base de datos
MONGODB_URI=mongodb+srv://...

# JWT
JWT_SECRET=tu_jwt_secret_muy_seguro
JWT_EXPIRES_IN=7d

# Telegram Bot (Configurado ✅)
TELEGRAM_BOT_TOKEN=8439254005:AAGlWyC9XjXCIyeg5vBtv1WMzvpzqN4e5n4
TELEGRAM_ADMIN_CHAT_ID=8382640858
TELEGRAM_COMMUNITY_LINK=https://t.me/grow5x_community
TELEGRAM_SECRET_TOKEN=grow5x_telegram_webhook_secret_2025
TELEGRAM_WEBHOOK_URL=https://grow5x.app/api/webhooks/telegram
TELEGRAM_ENABLED=true

# Configuración
PORT=5000
NODE_ENV=production
```

## 🚀 Producción

### Frontend
```bash
cd frontend
npm run build
# Archivos generados en /dist
```

### Backend
```bash
cd backend
npm start
```

## 📱 Telegram Bot

### 🤖 Configuración Completa ✅
- **Bot:** @Grow5XBot (GrowX5 Activación Bot)
- **Webhook:** `/api/webhooks/telegram`
- **Comandos:** `/start`, `/help`, `/status`
- **OTP:** Códigos de verificación para retiros
- **Notificaciones:** Alertas administrativas automáticas

### 🛠️ Scripts de Gestión
```bash
# Configurar webhook
npm run telegram:setup

# Verificar estado
npm run telegram:status

# Eliminar webhook
npm run telegram:delete
```

### 📋 Documentación
Ver `backend/TELEGRAM-CONFIG.md` para detalles completos.

## 📋 Próximos Pasos

### 🔄 Pendientes
- [ ] Configurar despliegue en VPS (PM2 + Nginx)
- [ ] Ejecutar smoke test E2E completo
- [ ] Configurar monitoreo y logs

### 🎯 Despliegue
- **Dominio:** https://grow5x.app
- **VPS:** 80.78.25.79
- **Base de datos:** MongoDB Atlas
- **Proxy:** Nginx (/api → localhost:5000)

## 🧪 Testing

### Flujo de Prueba Completo
1. Registro con código de referido
2. Login y acceso al dashboard
3. Compra de licencia con txHash
4. Confirmación admin y activación
5. Ejecución de CRON para beneficios
6. Solicitud de retiro con OTP Telegram
7. Aprobación y completado de retiro

---

**Estado:** ✅ Integración Frontend-Backend Completada
**Última actualización:** $(Get-Date -Format "yyyy-MM-dd HH:mm")