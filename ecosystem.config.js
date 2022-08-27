module.exports = {
  apps: [
    {
      name: 'jetstream',
      script: 'dist/apps/api/main.js',
      exec_mode: 'cluster',
      instances: -1,
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
