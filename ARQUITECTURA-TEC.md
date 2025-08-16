# 🏗️ Arquitectura Técnica — Grow5X (MVP)

## Lenguajes y versiones
- **Backend**: Node.js 20 LTS, JavaScript (ES2022)
- **Frontend**: React 18 + Vite 5
- **DB**: MongoDB Atlas (M10+) — **obligatorio**

## Dependencias (backend)
```bash
npm i express mongoose jsonwebtoken bcryptjs zod cors dotenv helmet pino pino-pretty
npm i dayjs node-cron uuid axios
npm i telegraf # o node-telegram-bot-api (elige uno)
npm i rate-limiter-flexible
npm i --save-dev nodemon
```
> En prod: deshabilitar `cors` y usar **origen único** vía Nginx.

## Dependencias (frontend)
```bash
npm i react react-dom react-router-dom axios
npm i zustand
npm i react-hook-form zod @hookform/resolvers
npm i react-toastify # o sweetalert2
npm i --save-dev tailwindcss postcss autoprefixer
```

## Estructura de carpetas

```
grow5x/
├── backend/
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config/
│   │   │   ├── env.js
│   │   │   └── atlas-assert.js
│   │   ├── db/
│   │   │   └── connect.js
│   │   ├── middlewares/
│   │   │   ├── auth.js
│   │   │   └── errors.js
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Package.js
│   │   │   ├── Wallet.js
│   │   │   ├── Purchase.js
│   │   │   ├── Transaction.js
│   │   │   ├── BenefitPlan.js
│   │   │   ├── BenefitLedger.js
│   │   │   ├── Commission.js
│   │   │   ├── SpecialCode.js
│   │   │   └── Withdrawal.js
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── packages.routes.js
│   │   │   ├── payments.routes.js
│   │   │   ├── admin.routes.js
│   │   │   ├── benefits.routes.js
│   │   │   └── withdrawals.routes.js
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── packages.controller.js
│   │   │   ├── payments.controller.js
│   │   │   ├── admin.controller.js
│   │   │   ├── benefits.controller.js
│   │   │   └── withdrawals.controller.js
│   │   ├── services/
│   │   │   ├── BenefitsProcessor.js
│   │   │   ├── CommissionsProcessor.js
│   │   │   └── TelegramService.js
│   │   ├── utils/
│   │   │   ├── crypto.js
│   │   │   ├── pickRandomWallet.js
│   │   │   ├── validators.js
│   │   │   └── logger.js
│   │   └── jobs/
│   │       ├── daily-benefits.cron.js
│   │       └── unlock-commissions.cron.js
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx
    │   ├── api/axios.js
    │   ├── store/useAuth.js
    │   ├── pages/
    │   │   ├── Landing.jsx
    │   │   ├── Register.jsx
    │   │   ├── Login.jsx
    │   │   ├── Packages.jsx
    │   │   ├── Dashboard.jsx
    │   │   ├── Referrals.jsx
    │   │   └── Withdrawals.jsx
    │   ├── components/
    │   │   ├── PaymentModal.jsx
    │   │   └── Charts.jsx
    │   └── styles/
    ├── index.html
    ├── package.json
    └── .env.example
```

## Variables de entorno (backend) — `.env.example`
```
NODE_ENV=production
PORT=5000

# Mongo Atlas
MONGODB_URI=mongodb+srv://...
DB_KIND=atlas

# JWT
JWT_SECRET=change_me
JWT_EXPIRES=7d

# Flags
ENABLE_BENEFITS_RELEASE=true
ENABLE_COMMISSIONS_RELEASE=true
READ_ONLY_API=false

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_ADMIN_CHAT_ID=

# Payout
PAYOUT_EXPORT_DIR=./exports
```

## Scripts sugeridos
**Backend `package.json`**
```json
{
  "scripts": {
    "dev": "nodemon src/server.js",
    "start": "node src/server.js",
    "cron": "node src/jobs/daily-benefits.cron.js && node src/jobs/unlock-commissions.cron.js",
    "assert": "node src/config/atlas-assert.js"
  }
}
```

**Frontend `package.json`**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

## Nginx (resumen)
- Proxy `/api` → `127.0.0.1:5000`
- Servir `frontend/dist` en `/`
- HTTPS obligatorio
