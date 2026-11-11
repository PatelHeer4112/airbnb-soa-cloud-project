const mongoose = require('mongoose');
const config = require('./env');

// Reject unknown query fields instead of silently ignoring them.
mongoose.set('strictQuery', true);

/**
 * Connect to MongoDB and make sure all model indexes exist.
 * The unique index on BookedNight is what prevents double bookings,
 * so we wait for index creation before accepting traffic.
 */
async function connectDB(uri = config.mongoUri) {
  // Make sure every model is registered before building indexes.
  require('../models');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

/** Returns a safe description of the DB URI (host + db name, never credentials). */
function describeUri(uri = config.mongoUri) {
  try {
    const u = new URL(uri);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return '(unparseable MongoDB URI)';
  }
}

function isConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connectDB, disconnectDB, describeUri, isConnected };
