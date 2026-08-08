// ============================================================================
// SEU ZÉLLA — PM2 Ecosystem Configuration
// ============================================================================
// Setup:
//   npm install -g pm2
//   pm2 start deploy/ecosystem.config.js --env production
//   pm2 save
//   pm2 startup (sigas as instruções exibidas)
//
// Comandos úteis:
//   pm2 status                  — ver status dos processos
//   pm2 logs seuzella           — ver logs em tempo real
//   pm2 restart seuzella        — reiniciar
//   pm2 reload seuzella         — reload zero-downtime (recomendado)
//   pm2 monit                   — dashboard CPU/MEM
//   pm2 list                    — listar processos
// ============================================================================

module.exports = {
  apps: [
    {
      name: 'seuzella',
      script: '.next/standalone/server.js',
      cwd: '/var/www/seuzella',
      instances: 2, // 2 clusters para usar 4 vCPU com folga
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G', // reinicia se passar de 1GB (limite MVK 4 = 16GB)
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
      },
      // Logs
      out_file: '/var/log/seuzella/pm2-out.log',
      error_file: '/var/log/seuzella/pm2-error.log',
      log_file_mode: '0644',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Restart policy
      min_uptime: '10s', // mínimo 10s uptime para ser considerado "up"
      max_restarts: 10, // máximo 10 restarts em 1h (evitar loop)
      restart_delay: 5000, // 5s entre restarts
      kill_timeout: 5000, // 5s graceful shutdown

      // Performance
      node_args: '--max-old-space-size=1024', // 1GB heap

      // Health check
      // pm2 vai reiniciar se o processo crashar ou passar de max_memory_restart
    },

    // ─── Worker para processamento assíncrono (opcional) ────────────────────
    // {
    //   name: 'seuzella-worker',
    //   script: 'workers/background-worker.js',
    //   cwd: '/var/www/seuzella',
    //   instances: 1,
    //   exec_mode: 'fork',
    //   autorestart: true,
    //   max_memory_restart: '500M',
    //   env: {
    //     NODE_ENV: 'production',
    //   },
    //   env_production: {
    //     NODE_ENV: 'production',
    //   },
    // },
  ],

  // ─── Deploy via SSH (opcional — para deploy remoto) ────────────────────────
  // deploy: {
  //   production: {
  //     user: 'deploy',
  //     host: 'seuzella.com.br',
  //     ref: 'origin/main',
  //     repo: 'git@github.com:MarcioCau14/SmartHotel_Zehla.git',
  //     path: '/var/www/seuzella',
  //     'post-deploy': 'npm install --legacy-peer-deps && npm run build && pm2 reload deploy/ecosystem.config.js --env production',
  //   },
  // },
};
