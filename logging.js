const pino = require('pino');

const logger = pino({
  // setting this to undefined prevents pino from adding hostname
  base: undefined,
  messageKey: 'message',
  // replace the # level with the level string
  formatters: {
    level(/** @type {any} */ level) {
      return { level };
    },
  },
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  mixin: () => ({ name: `quickcharts` }),
});

module.exports = {
  logger,
};
