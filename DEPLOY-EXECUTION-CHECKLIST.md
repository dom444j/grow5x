# 🚀 CHECKLIST DE EJECUCIÓN - DEPLOY VPS GROW5X

**INSTRUCCIONES PARA TRAE: Marca cada casilla `[x]` conforme completes cada paso. NO improvises.**

---

## 📋 PRE-REQUISITOS

- [ ] VPS Ubuntu 20.04+ configurado
- [ ] Dominio `grow5x.app` apuntando a IP 80.78.25.79
- [ ] MongoDB Atlas configurado
- [ ] Tokens Telegram listos
- [ ] Certificados SSL disponibles

---

## 🔧 1. PREPARACIÓN VPS

### Conexión y setup inicial
- [ ] `ssh root@80.78.25.79` - conexión exitosa
- [ ] `mkdir -p /var/www/grow5x` - directorios creados
- [ ] `cd /var/www/grow5x` - ubicado en directorio
- [ ] `git pull || git clone <REPO_URL> .` - código descargado

### Instalación de dependencias
- [ ] `apt update && apt upgrade -y` - sistema actualizado
- [ ] `apt install -y curl wget git nginx certbot python3-certbot-nginx` - paquetes instalados
- [ ] `curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -` - repo Node.js añadido
- [ ] `apt install -y nodejs` - Node.js instalado
- [ ] `npm install -g pm2` - PM2 instalado globalmente
- [ ] `mkdir -p /var/log/pm2` - directorio de logs creado

---

## 🗄️ 2. CONFIGURACIÓN MONGODB ATLAS

- [ ] Cluster MongoDB Atlas creado
- [ ] Usuario `grow5x_app` configurado con permisos lectura/escritura
- [ ] IP `80.78.25.79/32` añadida al allowlist (NO "anywhere")
- [ ] Connection string obtenido: `mongodb+srv://grow5x_app:<password>@<cluster>.mongodb.net/grow5x`
- [ ] Password URL-encoded correctamente

---

## 🔙 3. DEPLOY BACKEND

### Configuración .env
- [ ] `cd /var/www/grow5x/backend` - ubicado en backend
- [ ] `cp .env.production .env` - archivo .env copiado
- [ ] `nano .env` - editando variables:
  - [ ] `NODE_ENV=production` ✓
  - [ ] `PORT=5000` ✓
  - [ ] `MONGODB_URI=mongodb+srv://grow5x_app:REAL_PASSWORD@cluster.mongodb.net/grow5x...` ✓
  - [ ] `DB_KIND=atlas` ✓ (OBLIGATORIO)
  - [ ] `JWT_SECRET=SECURE_RANDOM_STRING` ✓
  - [ ] `ALLOWED_ORIGIN=https://grow5x.app` ✓
  - [ ] `TELEGRAM_BOT_TOKEN=REAL_TOKEN` ✓
  - [ ] `TELEGRAM_ADMIN_CHAT_ID=REAL_CHAT_ID` ✓
  - [ ] `TELEGRAM_WEBHOOK_SECRET=SECURE_SECRET` ✓

### Instalación y arranque
- [ ] `npm ci --only=production` - dependencias instaladas
- [ ] `pm2 start ecosystem.config.cjs --env production` - aplicación iniciada
- [ ] `pm2 save` - configuración guardada
- [ ] `pm2 startup` - auto-start configurado
- [ ] `pm2 status` - verificar estado "online"
- [ ] `pm2 logs grow5x-api --lines 20` - verificar logs sin errores

### Verificación backend
- [ ] `curl http://localhost:5000/api/health` - respuesta 200 OK
- [ ] Logs muestran "Connected to MongoDB Atlas"
- [ ] No errores críticos en logs

---

## 🎨 4. DEPLOY FRONTEND

### Build local (si es necesario)
- [ ] `cd frontend` (en máquina local)
- [ ] `echo "VITE_API_URL=https://grow5x.app/api" > .env.production` - env configurado
- [ ] `npm ci` - dependencias instaladas
- [ ] `npm run build` - build exitoso
- [ ] Directorio `dist/` generado

### Subida al VPS
- [ ] `scp -r dist/* root@80.78.25.79:/var/www/grow5x/frontend/dist/` - archivos subidos
- [ ] `chown -R www-data:www-data /var/www/grow5x/frontend/dist` - permisos configurados
- [ ] `chmod -R 755 /var/www/grow5x/frontend/dist` - permisos de lectura configurados

---

## 🌐 5. CONFIGURACIÓN NGINX

### SSL con Let's Encrypt
- [ ] `certbot --nginx -d grow5x.app -d www.grow5x.app` - certificados SSL obtenidos
- [ ] Certificados válidos y activos

### Configuración del sitio
- [ ] `cp nginx.conf /etc/nginx/sites-available/grow5x.app` - configuración copiada
- [ ] `ln -sf /etc/nginx/sites-available/grow5x.app /etc/nginx/sites-enabled/` - sitio habilitado
- [ ] `rm /etc/nginx/sites-enabled/default` - sitio default deshabilitado (opcional)
- [ ] `nginx -t` - configuración válida
- [ ] `systemctl reload nginx` - Nginx recargado
- [ ] `systemctl status nginx` - Nginx activo

---

## 🌱 6. SEEDS Y DATOS INICIALES

- [ ] `cd /var/www/grow5x/backend` - ubicado en backend
- [ ] `node scripts/seed-admin.js` - admin creado
- [ ] `node scripts/seed-packages.js` - paquetes Starter ($100) y Diamond ($500) creados
- [ ] `node scripts/seed-wallets.js` - pool de wallets BEP-20 creadas
- [ ] Verificar en logs que seeds se ejecutaron sin errores

---

## 📱 7. CONFIGURACIÓN TELEGRAM (OPCIONAL)

### Solo si usas webhook (no polling)
- [ ] `export TELEGRAM_BOT_TOKEN="tu_bot_token_real"` - variable exportada
- [ ] `export TELEGRAM_WEBHOOK_SECRET="tu_webhook_secret"` - variable exportada
- [ ] `curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=https://grow5x.app/api/telegram/webhook/$TELEGRAM_WEBHOOK_SECRET&drop_pending_updates=true"` - webhook configurado
- [ ] `curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"` - webhook verificado

---

## ✅ 8. PRUEBAS DE HUMO (CRÍTICAS)

### Health Checks
- [ ] `curl -s https://grow5x.app/api/health` - respuesta 200 con JSON válido
- [ ] `curl -s https://grow5x.app/` - frontend carga sin errores
- [ ] Navegador: https://grow5x.app/ carga correctamente
- [ ] Navegador: No errores en consola del navegador

### Flujo E2E Completo
- [ ] **Registro**: Crear cuenta con código de referido obligatorio
- [ ] **Login**: Iniciar sesión exitosamente
- [ ] **Dashboard**: `GET /api/me` responde correctamente
- [ ] **Compra**: `POST /api/payments/submit` asigna wallet aleatoria
- [ ] **Countdown**: Timer de confirmación funciona
- [ ] **Confirm Hash**: `POST /api/payments/confirm-hash` acepta hash
- [ ] **Admin Confirm**: Admin confirma compra
- [ ] **BenefitPlan**: Se crea plan de beneficios automáticamente
- [ ] **Comisiones**: Se crean comisiones pending:
  - [ ] Directa 10% (unlock D+9)
  - [ ] Padre 10% (unlock D+17)

### Sistema de Retiros
- [ ] Balance ≥ 50 USDT disponible
- [ ] `POST /api/me/withdrawals` - solicitud de retiro
- [ ] OTP llega por Telegram
- [ ] Admin puede `approve` retiro
- [ ] Admin puede `complete` retiro

### CRON Jobs
- [ ] `pm2 logs grow5x-api | grep -i cron` - CRON jobs inicializados
- [ ] Daily benefits processor activo
- [ ] Commission unlock processor activo

---

## 🔒 9. VERIFICACIÓN DE SEGURIDAD

### MongoDB Atlas
- [ ] Allowlist contiene SOLO `80.78.25.79/32`
- [ ] NO hay "0.0.0.0/0" o "anywhere" en allowlist
- [ ] Usuario tiene permisos mínimos necesarios

### Variables de Entorno
- [ ] `ALLOWED_ORIGIN=https://grow5x.app` (sin CORS abiertos)
- [ ] `JWT_SECRET` es seguro y único
- [ ] `TELEGRAM_WEBHOOK_SECRET` es seguro
- [ ] No hay credenciales hardcodeadas en código

### PM2 Persistencia
- [ ] `pm2 save` - configuración guardada
- [ ] `pm2 startup` - auto-start configurado
- [ ] Comando de startup ejecutado según instrucciones

---

## 📊 10. MONITOREO Y LOGS

### Estado de Servicios
- [ ] `pm2 status` - grow5x-api "online"
- [ ] `systemctl status nginx` - nginx "active (running)"
- [ ] `systemctl status mongodb` - si aplica

### Logs Finales
- [ ] `pm2 logs grow5x-api --lines 50` - sin errores críticos
- [ ] `tail -f /var/log/nginx/grow5x_access.log` - requests llegando
- [ ] `tail -f /var/log/nginx/grow5x_error.log` - sin errores 5xx

---

## 📸 EVIDENCIAS REQUERIDAS

**PEGAR CAPTURAS/OUTPUTS DE:**

- [ ] `curl -i https://grow5x.app/api/health` - respuesta completa
- [ ] `pm2 status` - estado de procesos
- [ ] `pm2 logs grow5x-api --lines 10` - últimas líneas sin errores
- [ ] Navegador: Landing page https://grow5x.app/ cargando
- [ ] Navegador: Registro con referido funcionando
- [ ] Navegador: Compra mostrando wallet y countdown
- [ ] Navegador: Dashboard con plan activo
- [ ] Telegram: OTP de retiro recibido
- [ ] Admin panel: Confirmación de compra

---

## 🚨 PLAN DE ROLLBACK (SI ALGO FALLA)

- [ ] `pm2 restart grow5x-api --update-env` - reiniciar app
- [ ] `git checkout main && git pull` - volver a versión estable
- [ ] `systemctl reload nginx` - recargar nginx
- [ ] Repetir smoke tests
- [ ] Documentar error y logs antes del rollback

---

## ✅ CHECKLIST FINAL

- [ ] Backend corriendo en PM2 (online)
- [ ] Frontend servido por Nginx
- [ ] SSL funcionando (https://)
- [ ] MongoDB Atlas conectado
- [ ] Seeds ejecutados
- [ ] Telegram configurado
- [ ] CRON jobs activos
- [ ] Health checks OK
- [ ] Flujo E2E validado
- [ ] Retiros con OTP validados
- [ ] Evidencias documentadas
- [ ] PM2 auto-start configurado

---

**🎉 DEPLOY COMPLETADO - GROW5X EN PRODUCCIÓN**

**Fecha de deploy:** ___________
**Ejecutado por:** Trae
**Versión desplegada:** ___________
**Notas adicionales:** ___________