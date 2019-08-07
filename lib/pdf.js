const PDFDocument = require('pdfkit');

function getPdfBufferFromPng(image, pdfKitImageOptions) {
  const ret = new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();

      let buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        let pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      doc.image(image, 0, 0, Object.assign({
        fit: [doc.page.width, doc.page.height],
        align: 'center',
        valign: 'center',
      }, pdfKitImageOptions || {}));
      doc.end();
    } catch(err) {
      reject(`PDF generation error: ${err.message}`);
    }
  });
  return ret;
}

function getPdfBufferWithText(text) {
  const ret = new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();

      let buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        let pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      doc.fontSize(24);
      doc.text(text, 100, 100);
      doc.end();
    } catch(err) {
      reject(`PDF generation error: ${err.message}`);
    }
  });
  return ret;
}

module.exports = {
  getPdfBufferFromPng,
  getPdfBufferWithText,
};
