const bunyan = require('bunyan');

const logger = bunyan.createLogger({
  name: 'quickchart',
  streams: [{ stream: process.stdout, level: process.env.LOG_LEVEL }],
});

module.exports = {
  logger,
};
