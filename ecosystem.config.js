module.exports = {
  apps: [
    {
      name: 'seuzella-production',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      exec_mode: 'cluster',
      instances: 'max',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      listen_timeout: 10000,
      kill_timeout: 5000,
    },
  ],
};
