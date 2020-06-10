const path = require('path');

const RedisStore = require('rate-limit-redis');
const express = require('express');
const javascriptStringify = require('javascript-stringify').stringify;
const qs = require('qs');
const rateLimit = require('express-rate-limit');
const text2png = require('text2png');

const apiKeys = require('./api_keys');
const packageJson = require('./package.json');
const telemetry = require('./telemetry');
const { getPdfBufferFromPng, getPdfBufferWithText } = require('./lib/pdf');
const { logger } = require('./logging');
const { renderChartJs } = require('./lib/charts');
const { renderGraphviz } = require('./lib/graphviz');
const { toChartJs, parseSize } = require('./lib/google_image_charts');
const { renderQr, DEFAULT_QR_SIZE } = require('./lib/qr');

const app = express();

const isDev = app.get('env') === 'development' || app.get('env') === 'test';

app.set('query parser', str =>
  qs.parse(str, {
    decode(s) {
      // Default express implementation replaces '+' with space. We don't want
      // that. See https://github.com/expressjs/express/issues/3453
      return decodeURIComponent(s);
    },
  }),
);

app.use(
  express.json({
    limit: process.env.EXPRESS_JSON_LIMIT || '100kb',
  }),
);

app.use(express.urlencoded());

if (process.env.RATE_LIMIT_PER_MIN) {
  const limitMax = parseInt(process.env.RATE_LIMIT_PER_MIN, 10);
  logger.info('Enabling rate limit:', limitMax);

  let store = undefined;
  if (process.env.REDIS_URL) {
    logger.info(`Connecting to redis: ${process.env.REDIS_URL}`);
    store = new RedisStore({
      redisURL: process.env.REDIS_URL,
    });
  }

  const limiter = rateLimit({
    store,
    windowMs: 60 * 1000,
    max: limitMax,
    message:
      'Please slow down your requests! This is a shared public endpoint. Email support@quickchart.io or go to https://quickchart.io/pricing for rate limit exceptions or to purchase a commercial license.',
    onLimitReached: req => {
      logger.info('User hit rate limit!', req.ip);
    },
    skip: req => {
      // If user has a special key, bypass rate limiting.
      const ret = apiKeys.requestHasValidKey(req);
      if (ret) {
        apiKeys.countRequest(req);
      }
      return ret;
    },
    keyGenerator: req => {
      return req.headers['x-forwarded-for'] || req.ip;
    },
  });
  app.use('/chart', limiter);
}

app.get('/', (req, res) => {
  res.send(
    'QuickChart is running!<br><br>If you are using QuickChart commercially, please consider <a href="https://quickchart.io/pricing/">purchasing a license</a> to support the project.',
  );
});

app.post('/telemetry', (req, res) => {
  const chartCount = parseInt(req.body.chartCount, 10);
  const qrCount = parseInt(req.body.qrCount, 10);
  const pid = req.body.pid;

  if (chartCount && !isNaN(chartCount)) {
    telemetry.receive(pid, 'chartCount', chartCount);
  }
  if (qrCount && !isNaN(qrCount)) {
    telemetry.receive(pid, 'qrCount', qrCount);
  }

  res.send({ success: true });
});

app.get('/api/account/:key', (req, res) => {
  const key = req.params.key;
  res.send({
    isValid: apiKeys.isValidKey(key),
    numRecentRequests: apiKeys.getNumRecentRequests(key),
  });
});

function failPng(res, msg, statusCode = 500) {
  res.writeHead(statusCode, {
    'Content-Type': 'image/png',
  });
  res.end(
    text2png(`Chart Error: ${msg}`, {
      padding: 10,
      backgroundColor: '#fff',
    }),
  );
}

function failSvg(res, msg, statusCode = 500) {
  res.writeHead(statusCode, {
    'Content-Type': 'image/svg+xml',
  });
  res.end(`
<svg viewBox="0 0 240 80" xmlns="http://www.w3.org/2000/svg">
  <style>
    p {
      font-size: 8px;
    }
  </style>
  <foreignObject width="240" height="80"
   requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility">
    <p xmlns="http://www.w3.org/1999/xhtml">${msg}</p>
  </foreignObject>
</svg>`);
}

async function failPdf(res, msg) {
  const buf = await getPdfBufferWithText(msg);
  res.writeHead(500, {
    'Content-Type': 'application/pdf',
  });
  res.end(buf);
}

function renderChartToImage(req, res, opts) {
  opts.failFn = failPng;
  opts.onRenderHandler = buf => {
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': buf.length,

      // 1 week cache
      'Cache-Control': isDev ? 'no-cache' : 'public, max-age=604800',
    });
    res.end(buf);
  };
  doChartjsRender(req, res, opts);
}

async function renderChartToPdf(req, res, opts) {
  opts.failFn = failPdf;
  opts.onRenderHandler = async buf => {
    const pdfBuf = await getPdfBufferFromPng(buf);

    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuf.length,

      // 1 week cache
      'Cache-Control': isDev ? 'no-cache' : 'public, max-age=604800',
    });
    res.end(pdfBuf);
  };
  doChartjsRender(req, res, opts);
}

function doChartjsRender(req, res, opts) {
  if (!opts.chart) {
    opts.failFn(res, 'You are missing variable `c` or `chart`');
    return;
  }

  let width = 500;
  let height = 300;
  if (opts.height) {
    const heightNum = parseInt(opts.height, 10);
    if (!Number.isNaN(heightNum)) {
      height = heightNum;
    }
  }
  if (opts.width) {
    const widthNum = parseInt(opts.width, 10);
    if (!Number.isNaN(widthNum)) {
      width = widthNum;
    }
  }

  let untrustedInput = opts.chart;
  if (opts.encoding === 'base64') {
    // TODO(ian): Move this decoding up the call stack.
    try {
      untrustedInput = Buffer.from(opts.chart, 'base64').toString('utf8');
    } catch (err) {
      logger.warn('base64 malformed', err);
      opts.failFn(res, err);
      return;
    }
  }

  renderChartJs(width, height, opts.backgroundColor, opts.devicePixelRatio, untrustedInput)
    .then(opts.onRenderHandler)
    .catch(err => {
      logger.warn('Chart error', err);
      opts.failFn(res, err);
    });
}

async function handleGraphviz(req, res, graphVizDef, opts) {
  try {
    const buf = await renderGraphviz(req.query.chl, opts);
    res
      .status(200)
      .type(opts.format === 'png' ? 'image/png' : 'image/svg+xml')
      .end(buf);
  } catch (err) {
    if (opts.format === 'png') {
      failPng(res, `Graph Error: ${err}`);
    } else {
      failSvg(res, `Graph Error: ${err}`);
    }
  }
}

function handleGChart(req, res) {
  // TODO(ian): Move these special cases into Google Image Charts-specific
  // handler.
  if (req.query.cht.startsWith('gv')) {
    // Graphviz chart
    const format = req.query.chof;
    const engine = req.query.cht.indexOf(':') > -1 ? req.query.cht.split(':')[1] : 'dot';
    const opts = {
      format,
      engine,
    };
    if (req.query.chs) {
      const size = parseSize(req.query.chs);
      opts.width = size.width;
      opts.height = size.height;
    }
    handleGraphviz(req, res, req.query.chl, opts);
    return;
  } else if (req.query.cht === 'qr') {
    const size = parseInt(req.query.chs.split('x')[0], 10);
    const qrData = req.query.chl;
    const chldVals = (req.query.chld || '').split('|');
    const ecLevel = chldVals[0] || 'L';
    const margin = chldVals[1] || 4;
    const qrOpts = {
      margin: margin,
      width: size,
      errorCorrectionLevel: ecLevel,
    };

    const format = 'png';
    const encoding = 'UTF-8';
    renderQr(format, encoding, qrData, qrOpts)
      .then(buf => {
        res.writeHead(200, {
          'Content-Type': format === 'png' ? 'image/png' : 'image/svg+xml',
          'Content-Length': buf.length,

          // 1 week cache
          'Cache-Control': isDev ? 'no-cache' : 'public, max-age=604800',
        });
        res.end(buf);
      })
      .catch(err => {
        failPng(res, err);
      });

    telemetry.count('qrCount');
    return;
  }

  const converted = toChartJs(req.query);
  if (req.query.format === 'chartjs-config') {
    // Chart.js config
    res.writeHead(200, {
      'Content-Type': 'application/json',
    });
    res.end(javascriptStringify(converted.chart, undefined, 2));
    return;
  }

  renderChartJs(
    converted.width,
    converted.height,
    converted.backgroundColor,
    undefined,
    converted.chart,
  ).then(buf => {
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': buf.length,

      // 1 week cache
      'Cache-Control': isDev ? 'no-cache' : 'public, max-age=604800',
    });
    res.end(buf);
  });
  telemetry.count('chartCount');
}

app.get('/chart', async (req, res) => {
  if (req.query.cht) {
    // This is a Google Image Charts-compatible request.
    return await handleGChart(req, res);
  }

  const opts = {
    chart: req.query.c || req.query.chart,
    height: req.query.h || req.query.height,
    width: req.query.w || req.query.width,
    backgroundColor: req.query.backgroundColor || req.query.bkg,
    devicePixelRatio: req.query.devicePixelRatio,
    encoding: req.query.encoding || 'url',
  };

  if (req.query.sig && !apiKeys.verifySignature(opts.chart, req.query.sig, req.query.accountId)) {
    failPng(res, 'Invalid signature', 403);
    return;
  }

  const outputFormat = (req.query.f || req.query.format || '').toLowerCase();

  if (outputFormat === 'pdf') {
    renderChartToPdf(req, res, opts);
  } else {
    renderChartToImage(req, res, opts);
  }

  telemetry.count('chartCount');
});

app.post('/chart', (req, res) => {
  const opts = {
    chart: req.body.c || req.body.chart,
    height: req.body.h || req.body.height,
    width: req.body.w || req.body.width,
    backgroundColor: req.body.backgroundColor || req.body.bkg,
    devicePixelRatio: req.body.devicePixelRatio,
    encoding: req.body.encoding || 'url',
  };
  const outputFormat = (req.body.f || req.body.format || '').toLowerCase();

  if (outputFormat === 'pdf') {
    renderChartToPdf(req, res, opts);
  } else {
    renderChartToImage(req, res, opts);
  }

  telemetry.count('chartCount');
});

app.get('/qr', (req, res) => {
  const qrText = req.query.text;
  if (!qrText) {
    failPng(res, 'You are missing variable `text`');
    return;
  }

  if (req.query.sig && !apiKeys.verifySignature(qrText, req.query.sig, req.query.accountId)) {
    failPng(res, 'Invalid signature', 403);
    return;
  }

  let format = 'png';
  if (req.query.format === 'svg') {
    format = 'svg';
  }

  const { mode } = req.query;

  const margin = typeof req.query.margin === 'undefined' ? 4 : parseInt(req.query.margin, 10);
  const ecLevel = req.query.ecLevel || undefined;
  const size = Math.min(3000, parseInt(req.query.size, 10)) || DEFAULT_QR_SIZE;
  const darkColor = req.query.dark || '000';
  const lightColor = req.query.light || 'fff';

  let qrData;
  try {
    qrData = decodeURIComponent(qrText);
  } catch (err) {
    logger.warn('URI malformed', err);
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

  renderQr(format, mode, qrData, qrOpts)
    .then(buf => {
      res.writeHead(200, {
        'Content-Type': format === 'png' ? 'image/png' : 'image/svg+xml',
        'Content-Length': buf.length,

        // 1 week cache
        'Cache-Control': isDev ? 'no-cache' : 'public, max-age=604800',
      });
      res.end(buf);
    })
    .catch(err => {
      failPng(res, err);
    });

  telemetry.count('qrCount');
});

app.get('/gchart', handleGChart);

app.get('/healthcheck', (req, res) => {
  // A lightweight healthcheck endpoint.
  res.send({ success: true, version: packageJson.version });
});

app.get('/healthcheck/chart', (req, res) => {
  // A heavier healthcheck endpoint that redirects to a unique chart.
  const labels = [...Array(5)].map(() => Math.random());
  const data = [...Array(5)].map(() => Math.random());
  const template = `
{
  type: 'bar',
  data: {
    labels: [${labels.join(',')}],
    datasets: [{
      data: [${data.join(',')}]
    }]
  }
}
`;
  res.redirect(`/chart?c=${template}`);
});

const port = process.env.PORT || 3400;
const server = app.listen(port);

const timeout = parseInt(process.env.REQUEST_TIMEOUT_MS, 10) || 1000;
server.setTimeout(timeout);
logger.info(`Setting request timeout: ${timeout} ms`);

logger.info(`NODE_ENV: ${process.env.NODE_ENV}`);
logger.info(`Listening on port ${port}`);

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

  process.on('SIGABRT', () => {
    logger.info('Caught SIGABRT');
  });
}

module.exports = app;
