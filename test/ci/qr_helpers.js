const Jimp = require('jimp');
const qrReader = require('qrcode-reader');

function getQrValue(buf) {
  return new Promise((resolve, reject) => {
    Jimp.read(buf, (err, image) => {
      if (err) {
        return reject(err);
      }
      const qr = new qrReader();
      qr.callback = (err, val) => {
        if (err) {
          return reject(err);
        }
        resolve(val.result);
      };
      qr.decode(image.bitmap);
    });
  });
}

module.exports = {
  getQrValue,
};
