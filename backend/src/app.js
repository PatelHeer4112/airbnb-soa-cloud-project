/**
 * Builds the Express application (no network listening here, so tests can
 * import it directly with Supertest).
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config/env');
const { isConnected } = require('./config/db');
const apiRouter = require('./routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

function corsOptions() {
  if (config.corsOrigins.includes('*')) return { origin: true };
  return {
    origin(origin, callback) {
      // Requests without an Origin header (curl, Postman, server-to-server) are allowed.
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  };
}

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Behind an AWS load balancer / reverse proxy, trust the first proxy hop.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors(corsOptions()));
  app.use(express.json({ limit: '10kb' }));
  if (!config.isTest) app.use(morgan(config.isProduction ? 'combined' : 'dev'));

  // Health check for load balancers and uptime monitors.
  app.get(['/health', '/api/health'], (req, res) => {
    const dbUp = isConnected();
    res.status(dbUp ? 200 : 503).json({
      success: dbUp,
      data: {
        status: dbUp ? 'ok' : 'degraded',
        database: dbUp ? 'connected' : 'disconnected',
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.use('/api', apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
