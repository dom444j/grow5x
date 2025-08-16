# 🚀 DEPLOY VPS CHECKLIST - Grow5X

## 📋 Requisitos Previos

- [ ] VPS con Ubuntu 20.04+ configurado
- [ ] Dominio `grow5x.app` apuntando a la IP del VPS (80.78.25.79)
- [ ] MongoDB Atlas configurado con allowlist de IP del VPS
- [ ] Tokens de Telegram Bot configurados
- [ ] Certificados SSL (Let's Encrypt) instalados

---

## 🔧 1. Preparación del Servidor

### Actualizar sistema
```bash
apt update && apt upgrade -y
apt install -y curl wget git nginx certbot python3-certbot-nginx
```

### Instalar Node.js y PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs
npm install -g pm2
```

### Crear directorios
```bash
mkdir -p /var/www/grow5x/{backend,frontend}
mkdir -p /var/log/pm2
chown -R www-data:www-data /var/www/grow5x
```

---

## 🗄️ 2. Configuración de Base de Datos

### MongoDB Atlas Setup
- [ ] Crear cluster en MongoDB Atlas
- [ ] Configurar usuario `grow5x_app` con permisos de lectura/escritura
- [ ] Añadir IP del VPS (80.78.25.79) al allowlist
- [ ] Obtener connection string: `mongodb+srv://grow5x_app:<password>@<cluster>.mongodb.net/grow5x`

---

## 🔙 3. Despliegue Backend

### Copiar código
```bash
cd /var/www/grow5x/backend
# Opción 1: Git clone
git clone https://github.com/usuario/grow5x.git .

# Opción 2: SCP desde local
# scp -r ./backend/* root@80.78.25.79:/var/www/grow5x/backend/
```

### Configurar .env de producción
```bash
cp .env.production .env
# Editar .env con valores reales:
nano .env
```

**Variables críticas a configurar:**
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://grow5x_app:REAL_PASSWORD@cluster0.mongodb.net/grow5x?retryWrites=true&w=majority&appName=grow5x
DB_KIND=atlas
JWT_SECRET=SECURE_RANDOM_STRING_HERE
ALLOWED_ORIGIN=https://grow5x.app
TELEGRAM_BOT_TOKEN=REAL_BOT_TOKEN
TELEGRAM_ADMIN_CHAT_ID=REAL_CHAT_ID
TELEGRAM_WEBHOOK_SECRET=SECURE_WEBHOOK_SECRET
```

### Instalar dependencias y iniciar
```bash
npm ci --only=production
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

### Verificar backend
```bash
pm2 status
pm2 logs grow5x-api
curl http://localhost:5000/api/health
```

---

## 🎨 4. Despliegue Frontend

### Build local y subida
```bash
# En tu máquina local:
cd frontend
echo "VITE_API_URL=https://grow5x.app/api" > .env.production
npm ci
npm run build

# Subir al VPS
scp -r dist/* root@80.78.25.79:/var/www/grow5x/frontend/dist/
```

### Configurar permisos
```bash
chown -R www-data:www-data /var/www/grow5x/frontend/dist
chmod -R 755 /var/www/grow5x/frontend/dist
```

---

## 🌐 5. Configuración Nginx

### SSL con Let's Encrypt
```bash
certbot --nginx -d grow5x.app -d www.grow5x.app
```

### Configurar sitio
```bash
cp nginx.conf /etc/nginx/sites-available/grow5x.app
ln -s /etc/nginx/sites-available/grow5x.app /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## 🌱 6. Seeds y Datos Iniciales

```bash
cd /var/www/grow5x/backend
node scripts/seed-admin.js
node scripts/seed-packages.js
node scripts/seed-wallets.js
```

**Verificar seeds:**
- [ ] Admin creado con SpecialCode
- [ ] Paquetes Starter ($100) y Diamond ($500) creados
- [ ] Pool de wallets BEP-20 activas

---

## 🔧 7. Configuración Telegram

### Configurar webhook (si usas webhook)
```bash
export TELEGRAM_BOT_TOKEN="tu_bot_token"
export TELEGRAM_WEBHOOK_SECRET="tu_webhook_secret"

curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=https://grow5x.app/api/telegram/webhook/$TELEGRAM_WEBHOOK_SECRET&drop_pending_updates=true"
```

### Verificar configuración
```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

---

## ✅ 8. Pruebas de Humo

### Backend Health Check
```bash
curl -s https://grow5x.app/api/health
# Esperado: {"status":"ok","timestamp":"...","environment":"production"}
```

### Frontend
- [ ] https://grow5x.app/ carga correctamente
- [ ] Rutas `/register`, `/login`, `/packages` funcionan
- [ ] No hay errores en consola del navegador

### Flujo completo
1. [ ] **Registro** con código de referido obligatorio
2. [ ] **Login** exitoso → dashboard carga
3. [ ] **Compra**: `POST /api/payments/submit` → wallet asignada
4. [ ] **Confirmación hash** → `POST /api/payments/confirm-hash`
5. [ ] **Admin confirma** → BenefitPlan creado + comisiones pending
6. [ ] **CRON jobs** activos (verificar logs)
7. [ ] **Retiro** (si balance ≥ 50) → OTP por Telegram

### Logs importantes
```bash
pm2 logs grow5x-api --lines 50
tail -f /var/log/nginx/grow5x_access.log
tail -f /var/log/nginx/grow5x_error.log
```

---

## 🔒 9. Seguridad Final

### MongoDB Atlas
- [ ] Allowlist solo IP del VPS: `80.78.25.79/32`
- [ ] Usuario con permisos mínimos necesarios

### Variables de entorno
- [ ] `ALLOWED_ORIGIN=https://grow5x.app` (sin CORS abiertos)
- [ ] `JWT_SECRET` seguro y único
- [ ] `TELEGRAM_WEBHOOK_SECRET` seguro

### PM2 persistencia
```bash
pm2 save
pm2 startup
# Seguir instrucciones del comando startup
```

### Firewall básico
```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

---

## 📊 10. Monitoreo

### Comandos útiles
```bash
# Estado de servicios
pm2 status
pm2 monit
systemctl status nginx

# Logs en tiempo real
pm2 logs grow5x-api --lines 100 --raw
tail -f /var/log/nginx/grow5x_error.log

# Reiniciar servicios
pm2 restart grow5x-api
systemctl reload nginx

# Verificar conexión DB
pm2 logs grow5x-api | grep -i "connected to mongodb"
```

### Health endpoints
- Backend: https://grow5x.app/api/health
- Frontend: https://grow5x.app/

---

## 🚨 Troubleshooting

### Backend no inicia
1. Verificar `.env` tiene todas las variables
2. Verificar conexión a MongoDB Atlas
3. Revisar logs: `pm2 logs grow5x-api`

### Frontend no carga
1. Verificar archivos en `/var/www/grow5x/frontend/dist`
2. Verificar configuración Nginx
3. Revisar logs Nginx

### API no responde
1. Verificar PM2: `pm2 status`
2. Verificar puerto 5000: `netstat -tlnp | grep 5000`
3. Verificar proxy Nginx

---

## 📝 Checklist Final

- [ ] Backend corriendo en PM2
- [ ] Frontend servido por Nginx
- [ ] SSL configurado y funcionando
- [ ] MongoDB Atlas conectado
- [ ] Seeds ejecutados correctamente
- [ ] Telegram webhook configurado
- [ ] CRON jobs activos
- [ ] Health checks pasando
- [ ] Flujo de registro/compra/retiro funcionando
- [ ] Logs sin errores críticos
- [ ] PM2 configurado para auto-start

---

## 📸 Capturas Requeridas

1. **Landing page** cargando en https://grow5x.app/
2. **Health endpoint** respondiendo correctamente
3. **PM2 status** mostrando grow5x-api running
4. **Logs PM2** mostrando "Connected to MongoDB Atlas"
5. **Compra submit** mostrando wallet asignada
6. **Dashboard** con plan activo y beneficios
7. **OTP Telegram** para retiro
8. **Admin panel** funcionando

---

**🎉 ¡Despliegue completado! Grow5X está en producción.**