const crypto = require('crypto');

const { logger } = require('./logging');

const keys = new Set();
const accountIdToKey = {};

function addKeyLine(line) {
  const splits = line.split(':');
  keys.add(splits[0]);
  if (splits[1]) {
    accountIdToKey[splits[1]] = splits[0];
  }
}

try {
  const raw = require('./api_key_list.js').forEach(addKeyLine);
  logger.info(`Loaded ${keys.size} keys from API keyfile`);
} catch (err) {
  // No keyfile. That's ok.
}

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

function verifySignature(content, sig, accountId) {
  const expectedSig = crypto
    .createHmac('sha256', accountIdToKey[accountId] || '')
    .update(content, 'utf8')
    .digest('hex');
  if (expectedSig.length !== sig.length) {
    return false;
  }
  const verified = crypto.timingSafeEqual(
    Buffer.from(expectedSig, 'utf8'),
    Buffer.from(sig, 'utf8'),
  );
  return verified;
}

module.exports = {
  isValidKey,
  getKeyFromRequest,
  requestHasValidKey,
  countRequest,
  getNumRecentRequests,
  verifySignature,

  addKeyLine,
};
