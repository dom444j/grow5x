# 🚀 Guía Rápida de Despliegue - Grow5X

## Para Trae: Comandos Paso a Paso

### 1. Preparación del VPS
```bash
# Conectar al VPS
ssh root@80.78.25.79

# Crear directorio del proyecto
mkdir -p /var/www/grow5x
cd /var/www/grow5x

# Clonar o actualizar código
git clone <REPO_URL> .
# O si ya existe: git pull
```

### 2. Backend - Configuración y Deploy
```bash
# Ir al directorio backend
cd /var/www/grow5x/backend

# Copiar archivo de producción y configurar
cp .env.production .env
# EDITAR .env con credenciales reales:
# - MONGODB_URI (Atlas)
# - JWT_SECRET
# - TELEGRAM_BOT_TOKEN
# - TELEGRAM_ADMIN_CHAT_ID

# Instalar dependencias
npm ci --production

# Iniciar con PM2
pm2 start ecosystem.config.cjs --only grow5x-api
pm2 save
pm2 startup  # seguir instrucciones si es primera vez
```

### 3. Frontend - Build y Deploy
```bash
# En tu máquina local (NO en el VPS)
cd frontend
npm run build

# Subir dist/ al VPS
scp -r dist/ root@80.78.25.79:/var/www/grow5x/frontend/

# En el VPS, ajustar permisos
chown -R www-data:www-data /var/www/grow5x/frontend/dist
chmod -R 755 /var/www/grow5x/frontend/dist
```

### 4. Nginx - Configuración
```bash
# En el VPS
cp /var/www/grow5x/nginx.conf /etc/nginx/sites-available/grow5x
ln -sf /etc/nginx/sites-available/grow5x /etc/nginx/sites-enabled/grow5x

# Remover default si existe
rm -f /etc/nginx/sites-enabled/default

# Verificar y recargar
nginx -t
systemctl reload nginx
```

### 5. SSL con Certbot (Opcional pero Recomendado)
```bash
# Instalar certbot si no está
apt update && apt install -y certbot python3-certbot-nginx

# Obtener certificado SSL
certbot --nginx -d grow5x.app -d www.grow5x.app

# Verificar renovación automática
certbot renew --dry-run
```

### 6. Inicialización de Datos
```bash
# En el VPS, directorio backend
cd /var/www/grow5x/backend

# Ejecutar seeds (solo la primera vez)
npm run seed:admin
npm run seed:packages
npm run seed:wallets
```

### 7. Configurar Telegram (Opcional)
```bash
# Solo si quieres webhooks de Telegram
cd /var/www/grow5x/backend
npm run telegram:setup
```

### 8. Verificación Final
```bash
# Verificar servicios
pm2 status
systemctl status nginx
systemctl status mongodb  # si usas MongoDB local

# Verificar logs
pm2 logs grow5x-api
nginx -T  # verificar configuración

# Test de conectividad
curl -I https://grow5x.app/api/health
curl -I https://grow5x.app/
```

## 🔧 Script Automatizado (Alternativa)

```bash
# Editar REPO_URL en deploy.sh primero
vim /var/www/grow5x/deploy.sh

# Ejecutar deploy completo
chmod +x /var/www/grow5x/deploy.sh
./deploy.sh --full

# O deploy por partes
./deploy.sh --backend
./deploy.sh --frontend
```

## 📋 Checklist de Verificación

- [ ] VPS conectado y directorios creados
- [ ] Código clonado/actualizado
- [ ] .env configurado con credenciales reales
- [ ] PM2 ejecutando grow5x-api
- [ ] Frontend built y subido
- [ ] Nginx configurado y funcionando
- [ ] SSL configurado (opcional)
- [ ] Seeds ejecutados
- [ ] API responde en /api/health
- [ ] Frontend carga correctamente
- [ ] Logs sin errores críticos

## 🆘 Comandos de Emergencia

```bash
# Reiniciar servicios
pm2 restart grow5x-api
systemctl restart nginx

# Ver logs en tiempo real
pm2 logs grow5x-api --lines 50
tail -f /var/log/nginx/error.log

# Rollback rápido
pm2 stop grow5x-api
git checkout HEAD~1
pm2 start ecosystem.config.cjs --only grow5x-api
```

## 📞 Contacto

Si algo falla, revisar:
1. `DEPLOY-EXECUTION-CHECKLIST.md` (detallado)
2. `DEPLOY-VPS-CHECKLIST.md` (completo)
3. Logs de PM2 y Nginx

---
**¡Listo para producción! 🎉**