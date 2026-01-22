module.exports = {
  apps: [
    {
      name: 'studio-backend-v2',
      cwd: './',
      script: './dist/index.js',
      instances: "max", // Enable clustering
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        // Using the dedicated db folder
        DB_PATH: './db/local_db.sqlite'
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 4001,
        DB_PATH: '../.dev/local_db_dev.sqlite'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/backend-v2-error.log',
      out_file: './logs/backend-v2-out.log',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '1G'
    }
  ]
};
