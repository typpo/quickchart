const PDFDocument = require('pdfkit');

// Minimum margin between image and any edge of PDF.
const IMAGE_MARGIN = 35;

function getPdfBufferFromPng(image, opts) {
  const ret = new Promise((resolve, reject) => {
    try {
      const pdfKitDocumentOptions = {
        layout: opts.pdfLayout,
      };
      if (opts.pdfWidth && opts.pdfHeight) {
        pdfKitDocumentOptions.size = [opts.pdfWidth, opts.pdfHeight];
      }

      const doc = new PDFDocument(pdfKitDocumentOptions);

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      doc.image(image, IMAGE_MARGIN, IMAGE_MARGIN, {
        fit: [doc.page.width - IMAGE_MARGIN * 2, doc.page.height - IMAGE_MARGIN * 2],
        align: 'center',
      });
      doc.end();
    } catch (err) {
      reject(`PDF generation error: ${err.message}`);
    }
  });
  return ret;
}

function getPdfBufferWithText(text) {
  const ret = new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      doc.fontSize(24);
      doc.text(text, 100, 100);
      doc.end();
    } catch (err) {
      reject(`PDF generation error: ${err.message}`);
    }
  });
  return ret;
}

module.exports = {
  getPdfBufferFromPng,
  getPdfBufferWithText,
};
