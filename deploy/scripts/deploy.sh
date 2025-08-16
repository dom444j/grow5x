#!/bin/bash

# Script de Deploy Automatizado - Grow5X
# Uso: ./deploy.sh [backend|frontend|full]

set -e

# Configuración
VPS_IP="80.78.25.79"
VPS_USER="root"
BACKEND_PATH="/var/www/grow5x/backend"
FRONTEND_PATH="/var/www/grow5x/frontend"
APP_NAME="grow5x-api"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funciones de utilidad
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar conexión SSH
check_ssh() {
    log_info "Verificando conexión SSH..."
    if ssh -o ConnectTimeout=10 $VPS_USER@$VPS_IP "echo 'SSH OK'" > /dev/null 2>&1; then
        log_success "Conexión SSH establecida"
    else
        log_error "No se puede conectar al VPS via SSH"
        exit 1
    fi
}

# Deploy Backend
deploy_backend() {
    log_info "Iniciando deploy del backend..."
    
    # Verificar archivos locales
    if [ ! -f "backend/package.json" ]; then
        log_error "No se encuentra backend/package.json"
        exit 1
    fi
    
    # Crear backup del .env actual
    log_info "Creando backup de configuración..."
    ssh $VPS_USER@$VPS_IP "cd $BACKEND_PATH && cp .env .env.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true"
    
    # Subir archivos
    log_info "Subiendo archivos del backend..."
    rsync -avz --exclude='node_modules' --exclude='.env' --exclude='*.log' \
        backend/ $VPS_USER@$VPS_IP:$BACKEND_PATH/
    
    # Instalar dependencias y reiniciar
    log_info "Instalando dependencias..."
    ssh $VPS_USER@$VPS_IP "cd $BACKEND_PATH && npm ci --only=production"
    
    log_info "Reiniciando aplicación..."
    ssh $VPS_USER@$VPS_IP "pm2 restart $APP_NAME || pm2 start ecosystem.config.cjs --env production"
    
    # Verificar estado
    log_info "Verificando estado de la aplicación..."
    sleep 5
    if ssh $VPS_USER@$VPS_IP "pm2 list | grep -q $APP_NAME.*online"; then
        log_success "Backend desplegado correctamente"
    else
        log_error "Error en el despliegue del backend"
        ssh $VPS_USER@$VPS_IP "pm2 logs $APP_NAME --lines 20"
        exit 1
    fi
}

# Deploy Frontend
deploy_frontend() {
    log_info "Iniciando deploy del frontend..."
    
    # Verificar archivos locales
    if [ ! -f "frontend/package.json" ]; then
        log_error "No se encuentra frontend/package.json"
        exit 1
    fi
    
    # Build local
    log_info "Construyendo frontend..."
    cd frontend
    
    # Verificar .env.production
    if [ ! -f ".env.production" ]; then
        log_warning "No se encuentra .env.production, creando uno básico..."
        echo "VITE_API_URL=https://grow5x.app/api" > .env.production
    fi
    
    npm ci
    npm run build
    
    if [ ! -d "dist" ]; then
        log_error "Error en el build del frontend"
        exit 1
    fi
    
    # Crear backup del frontend actual
    log_info "Creando backup del frontend actual..."
    ssh $VPS_USER@$VPS_IP "cd $FRONTEND_PATH && mv dist dist.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true"
    
    # Subir archivos
    log_info "Subiendo archivos del frontend..."
    rsync -avz --delete dist/ $VPS_USER@$VPS_IP:$FRONTEND_PATH/dist/
    
    # Configurar permisos
    ssh $VPS_USER@$VPS_IP "chown -R www-data:www-data $FRONTEND_PATH/dist && chmod -R 755 $FRONTEND_PATH/dist"
    
    # Recargar Nginx
    log_info "Recargando Nginx..."
    ssh $VPS_USER@$VPS_IP "nginx -t && systemctl reload nginx"
    
    cd ..
    log_success "Frontend desplegado correctamente"
}

# Verificar salud de la aplicación
check_health() {
    log_info "Verificando salud de la aplicación..."
    
    # Verificar backend
    if curl -s -f "https://grow5x.app/api/health" > /dev/null; then
        log_success "Backend respondiendo correctamente"
    else
        log_error "Backend no responde"
        return 1
    fi
    
    # Verificar frontend
    if curl -s -f "https://grow5x.app/" > /dev/null; then
        log_success "Frontend cargando correctamente"
    else
        log_error "Frontend no carga"
        return 1
    fi
    
    log_success "Aplicación funcionando correctamente"
}

# Mostrar logs
show_logs() {
    log_info "Mostrando logs recientes..."
    ssh $VPS_USER@$VPS_IP "pm2 logs $APP_NAME --lines 20"
}

# Función principal
main() {
    local action=${1:-"full"}
    
    log_info "Iniciando deploy: $action"
    
    check_ssh
    
    case $action in
        "backend")
            deploy_backend
            ;;
        "frontend")
            deploy_frontend
            ;;
        "full")
            deploy_backend
            deploy_frontend
            ;;
        "health")
            check_health
            ;;
        "logs")
            show_logs
            ;;
        *)
            echo "Uso: $0 [backend|frontend|full|health|logs]"
            echo ""
            echo "  backend   - Despliega solo el backend"
            echo "  frontend  - Despliega solo el frontend"
            echo "  full      - Despliega backend y frontend"
            echo "  health    - Verifica salud de la aplicación"
            echo "  logs      - Muestra logs recientes"
            exit 1
            ;;
    esac
    
    if [ "$action" != "logs" ] && [ "$action" != "health" ]; then
        log_info "Verificando salud post-deploy..."
        sleep 10
        check_health
    fi
    
    log_success "Deploy completado: $action"
}

# Ejecutar función principal
main "$@"