# 📦 Deploy - Grow5X

## Estructura de Archivos

```
deploy/
├── README.md                     # Este archivo
├── DEPLOY-QUICK-GUIDE.md         # Guía rápida para Trae
├── DEPLOY-EXECUTION-CHECKLIST.md # Checklist detallado paso a paso
├── DEPLOY-VPS-CHECKLIST.md       # Checklist completo de despliegue
├── infra/
│   ├── nginx.conf                # Configuración de Nginx
│   └── ecosystem.config.cjs      # Configuración de PM2
└── scripts/
    └── deploy.sh                 # Script automatizado de deploy
```

## 🚀 Uso Rápido

### Para Trae (Despliegue Manual)
1. **Lee primero**: `DEPLOY-QUICK-GUIDE.md`
2. **Sigue el checklist**: `DEPLOY-EXECUTION-CHECKLIST.md`
3. **Usa los archivos de infra**: `infra/nginx.conf` y `infra/ecosystem.config.cjs`

### Para Deploy Automatizado
1. **Edita** `scripts/deploy.sh` (configura REPO_URL)
2. **Ejecuta** el script en el VPS

## 📋 Comandos Esenciales

```bash
# En el VPS
ssh root@80.78.25.79
cd /var/www/grow5x

# Opción 1: Manual (recomendado para primera vez)
# Seguir DEPLOY-QUICK-GUIDE.md

# Opción 2: Script automatizado
chmod +x scripts/deploy.sh
./scripts/deploy.sh --full
```

## 🔧 Archivos de Configuración

- **nginx.conf**: Proxy reverso, SSL, compresión, cache
- **ecosystem.config.cjs**: PM2 para el backend Node.js
- **deploy.sh**: Automatización completa del despliegue

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs: `pm2 logs grow5x-api`
2. Verifica Nginx: `nginx -t`
3. Consulta los checklists detallados

---
**¡Todo listo para producción! 🎉**