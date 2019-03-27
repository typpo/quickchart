const path = require('path');

const express = require('express');
const expressNunjucks = require('express-nunjucks');
const qs = require('qs');
const text2png = require('text2png');
const winston = require('winston');

const { renderChart } = require('./lib/charts');
const { renderQr } = require('./lib/qr');

const logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({ timestamp: true, colorize: true }),
  ],
});

const app = express();

const isDev = app.get('env') === 'development';

app.set('query parser', str => qs.parse(str, {
  decode(s) {
    // Default express implementation replaces '+' with space. We don't want
    // that. See https://github.com/expressjs/express/issues/3453
    return decodeURIComponent(s);
  },
}));
app.set('views', `${__dirname}/templates`);
app.use(express.static('public'));

expressNunjucks(app, {
  watch: isDev,
  noCache: isDev,
});

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/robots.txt', (req, res) => {
  res.sendFile(path.join(__dirname, './templates/robots.txt'));
});

function failPng(res, msg) {
  res.writeHead(500, {
    'Content-Type': 'image/png',
  });
  res.end(text2png(`Chart Error: ${msg}`, {
    padding: 10,
    backgroundColor: '#fff',
  }));
}

app.get('/chart', (req, res) => {
  if (!req.query.c) {
    failPng(res, 'You are missing variable `c`');
    return;
  }

  let height = 300;
  let width = 500;
  if (req.query.h || req.query.height) {
    const heightNum = parseInt(req.query.h || req.query.height, 10);
    if (!Number.isNaN(heightNum)) {
      height = heightNum;
    }
  }
  if (req.query.w || req.query.width) {
    const widthNum = parseInt(req.query.w || req.query.width, 10);
    if (!Number.isNaN(widthNum)) {
      width = widthNum;
    }
  }

  let untrustedInput;
  try {
    untrustedInput = req.query.c;
  } catch (err) {
    logger.error('URI malformed', err);
    failPng(res, err);
    return;
  }

  const backgroundColor = req.query.backgroundColor || req.query.bkg || 'transparent';

  renderChart(width, height, backgroundColor, untrustedInput).then((buf) => {
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': buf.length,

      // 1 week cache
      'Cache-Control': 'public, max-age=604800',
    });
    res.end(buf);
  }).catch((err) => {
    logger.error('Chart error', err);
    failPng(res, err);
  });
});

app.get('/qr', (req, res) => {
  if (!req.query.text) {
    failPng(res, 'You are missing variable `text`');
    return;
  }

  let format = 'png';
  if (req.query.format === 'svg') {
    format = 'svg';
  }

  const { mode } = req.query;

  const margin = parseInt(req.query.margin, 10) || 4;
  const ecLevel = req.query.ecLevel || undefined;
  const size = Math.min(3000, parseInt(req.query.size, 10)) || 150;
  const darkColor = req.query.dark || '000';
  const lightColor = req.query.light || 'fff';

  let qrData;
  try {
    qrData = decodeURIComponent(req.query.text);
  } catch (err) {
    logger.error('URI malformed', err);
    failPng(res, 'URI malformed');
    return;
  }
  const qrOpts = {
    margin,
    width: size,
    errorCorrectionLevel: ecLevel,
    color: {
      dark: darkColor,
      light: lightColor,
    },
  };

  renderQr(format, mode, qrData, qrOpts).then((buf) => {
    res.writeHead(200, {
      'Content-Type': `image/${format}`,
      'Content-Length': buf.length,

      // 1 week cache
      'Cache-Control': 'public, max-age=604800',
    });
    res.end(buf);
  }).catch((err) => {
    failPng(res, err);
  });
});

const port = process.env.PORT || 3400;
const server = app.listen(port);
logger.info('NODE_ENV:', process.env.NODE_ENV);
logger.info('Running on port', port);

if (!isDev) {
  const gracefulShutdown = function gracefulShutdown() {
    logger.info('Received kill signal, shutting down gracefully.');
    server.close(() => {
      logger.info('Closed out remaining connections.');
      process.exit();
    });

    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit();
    }, 10 * 1000);
  };

  // listen for TERM signal .e.g. kill
  process.on('SIGTERM', gracefulShutdown);

  // listen for INT signal e.g. Ctrl-C
  process.on('SIGINT', gracefulShutdown);
}

module.exports = app;
