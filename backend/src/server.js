/**
 * Process entry point: connect to MongoDB, then start the HTTP server.
 * Handles SIGINT/SIGTERM so the process stops cleanly (important on AWS,
 * where instances and containers are stopped with SIGTERM).
 */
const config = require('./config/env');
const { connectDB, disconnectDB, describeUri } = require('./config/db');
const createApp = require('./app');

async function start() {
  try {
    await connectDB();
    console.log(`[db] connected to ${describeUri()}`);
  } catch (err) {
    console.error(`[db] could not connect to ${describeUri()}: ${err.message}`);
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[server] ${config.nodeEnv} server listening on port ${config.port}`);
  });

  const shutdown = (signal) => {
    console.log(`[server] ${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    // Force exit if connections do not close in time.
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
