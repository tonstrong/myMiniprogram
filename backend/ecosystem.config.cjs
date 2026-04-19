module.exports = {
  apps: [
    {
      name: "closet-api",
      cwd: __dirname,
      script: "dist/main.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "closet-worker",
      cwd: __dirname,
      script: "dist/workers/main.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
