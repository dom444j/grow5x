# 🚀 Despliegue — VPS con Nginx + PM2 + Atlas ONLY

## 🗄️ Configuración de MongoDB Atlas - GrowX5

### Información General

**Cluster:** `grow5x-cluster.nufwbrc.mongodb.net`  
**Base de Datos:** `growx5`  
**Región:** `AWS / US East (N. Virginia)`  
**Tier:** `M0 Sandbox (Free)`  
**Versión MongoDB:** `7.0`  

### Configuración de Producción

Las credenciales de MongoDB Atlas están configuradas en el archivo `.env` del VPS:
```
/root/grow5x-oficial/backend/.env
```

**Variable de entorno requerida:**
```bash
MONGODB_URI=mongodb+srv://[usuario]:[contraseña]@grow5x-cluster.nufwbrc.mongodb.net/growx5?retryWrites=true&w=majority&appName=grow5x-cluster
```

### Configuración de Seguridad
- **Network Access:** Solo IP del VPS permitida (`80.78.25.79/32`)
- **Database Access:** Usuario dedicado con permisos mínimos necesarios
- **Backup:** Habilitado automáticamente
- **Monitoring:** Disponible en dashboard de Atlas

### Verificación de Conexión
Para verificar que la conexión funciona:
```bash
# Health check local
curl http://localhost:5000/api/health

# Health check externo
curl https://grow5x.app/api/health
```

Respuesta esperada:
```json
{
  "status": "ok",
  "environment": "production",
  "database": "connected",
  "dbState": {
    "readyState": 1,
    "host": "ac-t81ouqo-shard-00-01.nufwbrc.mongodb.net",
    "name": "growx5"
  }
}
```

---

**⚠️ Seguridad:** Las credenciales reales se mantienen únicamente en el archivo `.env` del servidor de producción. Nunca incluir credenciales en el repositorio.

## 🌐 Información del VPS
- **IP IPv4**: 80.78.25.79
- **IP IPv6**: 2a0a:3840:8078:25::504e:194f:1337
- **Acceso SSH**: root con clave SSH proporcionada
- **Dominio**: grow5x.app

## 1) Pre requisitos
- Node 20, PM2 global, Nginx con SSL, acceso a Mongo Atlas.
- `.env` completos en backend y frontend (`VITE_API_URL=https://grow5x.app/api`).
- Acceso SSH al VPS con las credenciales proporcionadas.

## Variables de entorno necesarias

```bash
# En el servidor VPS
export NODE_ENV=production
export PORT=5000
export MONGODB_URI="mongodb+srv://grow5x_app:p%2584od40%5BLt%7B3%2AD7%5D-jfo%5D72%24JUWBI9@cluster0.lyjjxws.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
export DB_KIND=atlas
export JWT_SECRET="tu_jwt_secret_seguro"
export JWT_EXPIRES=7d
export ENABLE_BENEFITS_RELEASE=true
export ENABLE_COMMISSIONS_RELEASE=true
export READ_ONLY_API=false
```

## 2) Backend
```bash
cd backend
npm ci
npm run assert   # valida Atlas ONLY
pm2 start src/server.js --name grow5x-api
```

## 3) Frontend
```bash
cd frontend
npm ci
npm run build
# Nginx sirve frontend/dist
```

## 4) Nginx (borrador)
```
server {
  listen 80;
  server_name grow5x.app;
  return 301 https://$host$request_uri;
}
server {
  listen 443 ssl http2;
  server_name grow5x.app;

  root /var/www/grow5x/frontend/dist;
  index index.html;

  location /api/ {
    proxy_pass http://127.0.0.1:5000/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    try_files $uri /index.html;
  }
}
```

## 5) Checklist de smoke test
- `GET /api/health` 200
- Registro con referido existente → OK
- Asignación wallet aleatoria → OK
- Confirmar compra desde admin → plan creado
- Cron beneficios ejecuta y asienta 12.5%
- D9 libera comisión directa; D17 libera Padre
- Retiro con PIN y mínimo 50 USDT
