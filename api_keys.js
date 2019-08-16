//
// This file handles exceptions to rate limiting via a api_key_list.js file.
//
// Queries are rate limited according to the RATE_LIMIT_PER_MIN envar. You can
// configure exceptions to the rate limiting rule by creating a api_key_list.js
// file that exports a list of arbitrary "keys" that a user may attach to their
// request (&key=xxx) in order to by pass rate limiting.
//

const fs = require('fs');

const winston = require('winston');

const logger = new winston.Logger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    new winston.transports.Console({ timestamp: true, colorize: true }),
  ],
});

let rawKeys;
try {
  rawKeys = require('./api_key_list.js');
  logger.info(`Loaded ${rawKeys.length} keys from API keyfile`);
} catch (err) {
  // No keyfile. That's ok.
  rawKeys = [];
}

const keys = new Set(rawKeys);

module.exports = keys;
