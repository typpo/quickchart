const path = require('path');

const { CanvasRenderService } = require('chartjs-node-canvas');
const chartDataLabels = require('chartjs-plugin-datalabels');
const express = require('express');
const expressNunjucks = require('express-nunjucks');
const qr = require('qr-image');
const text2png = require('text2png');
const winston = require('winston');
const { toJson } = require('really-relaxed-json');
const { NodeVM } = require('vm2');

const { addBackgroundColors, DEFAULT_COLOR_WHEEL } = require('./charts');

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
  res.end(text2png(`Chart Error: ${msg}`));
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
    if (!isNaN(heightNum)) {
      height = heightNum;
    }
  }
  if (req.query.w || req.query.width) {
    const widthNum = parseInt(req.query.w || req.query.width, 10);
    if (!isNaN(widthNum)) {
      width = widthNum;
    }
  }

  let chart;
  try {
    const vm = new NodeVM();

    const untrustedInput = decodeURIComponent(req.query.c);
    if (untrustedInput.match(/(for|while)\(/gi)) {
      failPng(res, 'Input is not allowed');
      return;
    }
    chart = vm.run(`module.exports = ${untrustedInput}`);
  } catch (err) {
    logger.error('Input Error', err)
    failPng(res, 'Invalid input');
    return;
  }

  if (chart.type === 'donut') {
    // Fix spelling...
    chart.type === 'doughnut';
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
    chart.data.datasets.forEach(dataset => {
      // Make line charts straight lines by default.
      dataset.lineTension = dataset.lineTension || 0;
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

  let canvasRenderService = new CanvasRenderService(width, height, (ChartJS) => {
    const backgroundColor = req.query.backgroundColor || req.query.bkg;
    if (backgroundColor) {
      ChartJS.pluginService.register({
        beforeDraw: (chartInstance, easing) => {
          var ctx = chartInstance.chart.ctx;
          ctx.fillStyle = backgroundColor;
          ctx.fillRect(0, 0, chartInstance.chart.width, chartInstance.chart.height);
        },
      });
    }
	});

  try {
    canvasRenderService.renderToBuffer(chart).then(buf => {
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': buf.length,

        // 1 week cache
        'Cache-Control': 'public, max-age=604800',
      });
      res.end(buf);
    }).catch(err => {
      logger.error('Chart error', err);
      failPng(res, 'Invalid chart options');
      return;
    });
  } catch(err) {
    // canvasRenderService doesn't seem to be throwing errors correctly for
    // certain chart errors.
    logger.error('Render error', err);
    failPng(res, 'Invalid chart options');
    return;
  }
});

app.get('/qr', (req, res) => {
  let format = 'png';
  if (req.query.format === 'svg') {
    format = 'svg';
  }
  const buf = qr.imageSync(decodeURIComponent(req.query.text), { type: format });
  res.writeHead(200, {
    'Content-Type': `image/${format}`,
    'Content-Length': buf.length,

    // 1 week cache
    'Cache-Control': 'public, max-age=604800',
  });
  res.end(buf);
});

if (!isDev) {
  function gracefulShutdown() {
    logger.info('Received kill signal, shutting down gracefully.');
    server.close(() => {
      logger.info('Closed out remaining connections.');
      process.exit();
    });

    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit();
    }, 10 * 1000);
  }

  // listen for TERM signal .e.g. kill
  process.on('SIGTERM', gracefulShutdown);

  // listen for INT signal e.g. Ctrl-C
  process.on('SIGINT', gracefulShutdown);
}

const port = process.env.PORT || 3400;
const server = app.listen(port);
logger.info('NODE_ENV:', process.env.NODE_ENV);
logger.info('Running on port', port);

module.exports = app;
