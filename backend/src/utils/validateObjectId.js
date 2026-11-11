const ApiError = require('./ApiError');

const OBJECT_ID = /^[a-f\d]{24}$/i;

/** Throw a 400 if the value is not a valid MongoDB ObjectId string. */
function assertObjectId(value, field = 'id') {
  if (typeof value !== 'string' || !OBJECT_ID.test(value)) {
    throw new ApiError(400, 'INVALID_ID', `${field} is not a valid ID`, [
      { field, message: `${field} must be a 24-character hexadecimal ID` },
    ]);
  }
}

module.exports = { assertObjectId };
