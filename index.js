const path = require('path');

const { CanvasRenderService } = require('chartjs-node-canvas');
const chartDataLabels = require('chartjs-plugin-datalabels');
const chartRadialGauge = require('chartjs-chart-radial-gauge');
const express = require('express');
const expressNunjucks = require('express-nunjucks');
const qrcode = require('qrcode');
const text2png = require('text2png');
const winston = require('winston');
const { NodeVM } = require('vm2');

const { addBackgroundColors } = require('./charts');

const logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({ timestamp: true, colorize: true }),
  ],
});

const app = express();

const isDev = app.get('env') === 'development';

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
    untrustedInput = decodeURIComponent(req.query.c);
  } catch (err) {
    logger.error('URI malformed', err);
    failPng(res, 'URI malformed');
    return;
  }

  let chart;
  try {
    if (untrustedInput.match(/(for|while)\(/gi)) {
      failPng(res, 'Input is not allowed');
      return;
    }
    const vm = new NodeVM();
    chart = vm.run(`module.exports = ${untrustedInput}`);
  } catch (err) {
    logger.error('Input Error', err);
    failPng(res, `Invalid input\n${err}`);
    return;
  }

  if (chart.type === 'donut') {
    // Fix spelling...
    chart.type = 'doughnut';
  }

  // Implement default options
  chart.options = chart.options || {};
  chart.options.devicePixelRatio = 2.0;
  if (chart.type === 'bar' || chart.type === 'line' || chart.type === 'scatter' || chart.type === 'bubble') {
    if (!chart.options.scales) {
      // TODO(ian): Merge default options with provided options
      chart.options.scales = {
        yAxes: [{
          ticks: {
            beginAtZero: true,
          },
        }],
      };
    }
    addBackgroundColors(chart);
  } else if (chart.type === 'radar') {
    addBackgroundColors(chart);
  } else if (chart.type === 'pie' || chart.type === 'doughnut') {
    addBackgroundColors(chart);
  } else if (chart.type === 'scatter') {
    addBackgroundColors(chart);
  } else if (chart.type === 'bubble') {
    addBackgroundColors(chart);
  }

  if (chart.type === 'line') {
    chart.data.datasets.forEach((dataset) => {
      const data = dataset;
      // Make line charts straight lines by default.
      data.lineTension = data.lineTension || 0;
    });
  }

  chart.options.plugins = chart.options.plugins || {};
  if (!chart.options.plugins.datalabels) {
    chart.options.plugins.datalabels = {};
    if (chart.type === 'pie' || chart.type === 'doughnut') {
      chart.options.plugins.datalabels = {
        display: true,
      };
    } else {
      chart.options.plugins.datalabels = {
        display: false,
      };
    }
  }

  logger.info('Chart:', JSON.stringify(chart));
  chart.plugins = [chartDataLabels];
  if (chart.type === 'radialGauge') {
    chart.plugins.push(chartRadialGauge);
  }

  const backgroundColor = req.query.backgroundColor || req.query.bkg || 'transparent';
  chart.plugins.push({
    id: 'background',
    beforeDraw: (chartInstance) => {
      const { ctx } = chartInstance.chart;
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, chartInstance.chart.width, chartInstance.chart.height);
    },
  });

  const canvasRenderService = new CanvasRenderService(width, height);

  try {
    canvasRenderService.renderToBuffer(chart).then((buf) => {
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': buf.length,

        // 1 week cache
        'Cache-Control': 'public, max-age=604800',
      });
      res.end(buf);
    }).catch((err) => {
      logger.error('Chart error', err);
      failPng(res, 'Invalid chart options');
    });
  } catch (err) {
    // canvasRenderService doesn't seem to be throwing errors correctly for
    // certain chart errors.
    logger.error('Render error', err);
    failPng(res, 'Invalid chart options');
  } finally {
    //canvasRenderService.destroy();
  }
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
  logger.info('QR code', format, qrOpts);

  const respFn = (sendBuf) => {
    res.writeHead(200, {
      'Content-Type': `image/${format}`,
      'Content-Length': sendBuf.length,

      // 1 week cache
      'Cache-Control': 'public, max-age=604800',
    });
    res.end(sendBuf);
  };

  if (format === 'svg') {
    qrcode.toString(qrData, qrOpts).then((str) => {
      respFn(Buffer.from(str, 'utf8'));
    }).catch((err) => {
      logger.error('QR render error (PNG)', err);
      failPng(res, `Error generating QR code\n${err}`);
    });
  } else {
    qrcode.toDataURL(qrData, qrOpts).then((dataUrl) => {
      respFn(Buffer.from(dataUrl.split(',')[1], 'base64'));
    }).catch((err) => {
      logger.error('QR render error (PNG)', err);
      failPng(res, `Error generating QR code\n${err}`);
    });
  }
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
