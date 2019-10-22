//
// This file handles exceptions to rate limiting via a api_key_list.js file.
//
// Queries are rate limited according to the RATE_LIMIT_PER_MIN envar. You can
// configure exceptions to the rate limiting rule by creating a api_key_list.js
// file that exports a list of arbitrary "keys" that a user may attach to their
// request (&key=xxx) in order to by pass rate limiting.
//

const { logger } = require('./logging');

let rawKeys;
try {
  rawKeys = require('./api_key_list.js');
  logger.info(`Loaded ${rawKeys.length} keys from API keyfile`);
} catch (err) {
  // No keyfile. That's ok.
  rawKeys = [];
}

const keys = new Set(rawKeys);

// Map from key to number of recent requests - this is not persisted through
// restarts.
const recentRequestCount = {};

function isValidKey(key) {
  return keys.has(key);
}

function getKeyFromRequest(req) {
  if (req.query.key) {
    return req.query.key;
  }
  if (req.body.key) {
    return req.body.key;
  }
  return null;
}

function requestHasValidKey(req) {
  const key = getKeyFromRequest(req);
  if (key) {
    return isValidKey(key);
  }
  return false;
}

function countRequest(req) {
  const key = getKeyFromRequest(req);
  if (!key) {
    return;
  }
  if (!recentRequestCount[key]) {
    recentRequestCount[key] = 0;
  }
  recentRequestCount[key] += 1;
}

function getNumRecentRequests(key) {
  return recentRequestCount[key] || 0;
}

module.exports = {
  isValidKey,
  getKeyFromRequest,
  requestHasValidKey,
  countRequest,
  getNumRecentRequests,
};
