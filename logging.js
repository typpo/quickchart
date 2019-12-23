const path = require('path');

const bunyan = require('bunyan');
const { LoggingBunyan } = require('@google-cloud/logging-bunyan');

const loggingBunyan = new LoggingBunyan({
  projectId: process.env.STACKDRIVER_PROJECT_ID,
  keyFilename: process.env.STACKDRIVER_KEYFILE,
});

function getStreams() {
  const streams = [{ stream: process.stdout, level: process.env.LOG_LEVEL }];
  if (process.env.NODE_ENV === 'production' && process.env.STACKDRIVER_PROJECT_ID) {
    console.log('Using stackdriver logging!');
    streams.push(loggingBunyan.stream('debug'));
  } else {
    console.log('Stackdriver logging is disabled');
  }
  return streams;
}

const logger = bunyan.createLogger({
  name: 'quickchart',
  streams: getStreams(),
});

module.exports = {
  logger,
};
