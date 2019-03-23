const qrcode = require('qrcode');
const winston = require('winston');

const logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({ timestamp: true, colorize: true }),
  ],
});

function renderQr(format, qrData, qrOpts) {
  logger.info('QR code', format, qrOpts);

  return new Promise((resolve, reject) => {
    if (format === 'svg') {
      qrcode.toString(qrData, qrOpts).then((str) => {
        resolve(Buffer.from(str, 'utf8'));
      }).catch((err) => {
        logger.error('QR render error (PNG)', err);
        reject(`Could not generate QR\n${err}`);
      });
    } else {
      qrcode.toDataURL(qrData, qrOpts).then((dataUrl) => {
        resolve(Buffer.from(dataUrl.split(',')[1], 'base64'));
      }).catch((err) => {
        logger.error('QR render error (PNG)', err);
        reject(`Could not generate QR\n${err}`);
      });
    }
  });
}

module.exports = {
  renderQr,

};
