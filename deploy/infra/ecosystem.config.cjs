module.exports = {
  apps: [
    {
      name: 'grow5x-api',
      script: 'src/server.js',
      cwd: '/var/www/grow5x/backend',
      instances: 1,
      exec_mode: 'fork',
      
      // Configuración de entorno
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      
      // Configuración de logs
      log_file: '/var/log/pm2/grow5x-api.log',
      out_file: '/var/log/pm2/grow5x-api-out.log',
      error_file: '/var/log/pm2/grow5x-api-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Configuración de reinicio
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      restart_delay: 4000,
      
      // Configuración de cluster (si se necesita)
      min_uptime: '10s',
      max_restarts: 10,
      
      // Variables de entorno específicas
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
        LOG_LEVEL: 'info'
      },
      
      // Configuración adicional
      merge_logs: true,
      time: true,
      
      // Script de inicio personalizado (opcional)
      // pre_start: 'echo "Starting Grow5X API..."',
      // post_start: 'echo "Grow5X API started successfully"'
    }
  ],
  
  // Configuración de despliegue (opcional)
  deploy: {
    production: {
      user: 'root',
      host: '80.78.25.79',
      ref: 'origin/main',
      repo: 'git@github.com:usuario/grow5x.git',
      path: '/var/www/grow5x',
      'pre-deploy-local': '',
      'post-deploy': 'cd backend && npm ci && pm2 reload ecosystem.config.cjs --env production',
      'pre-setup': ''
    }
  }
};

// Comandos útiles:
// pm2 start ecosystem.config.cjs --env production
// pm2 reload ecosystem.config.cjs --env production
// pm2 stop grow5x-api
// pm2 restart grow5x-api
// pm2 logs grow5x-api
// pm2 monit
// pm2 save
// pm2 startup