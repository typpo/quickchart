const path = require('path');

const express = require('express');
const javascriptStringify = require('javascript-stringify').stringify;
const qs = require('qs');
const rateLimit = require('express-rate-limit');
const text2png = require('text2png');

const packageJson = require('./package.json');
const telemetry = require('./telemetry');
const { getPdfBufferFromPng, getPdfBufferWithText } = require('./lib/pdf');
const { logger } = require('./logging');
const { renderChartJs } = require('./lib/charts');
const { renderGraphviz } = require('./lib/graphviz');
const { toChartJs, parseSize } = require('./lib/google_image_charts');
const { renderQr, DEFAULT_QR_SIZE } = require('./lib/qr');

const db = require('./lib/db');

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

  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: limitMax,
    message:
      'Please slow down your requests! This is a shared public endpoint. Email support@quickchart.io or go to https://quickchart.io/pricing/ for rate limit exceptions or to purchase a commercial license.',
    onLimitReached: req => {
      logger.info('User hit rate limit!', req.ip);
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

function utf8ToAscii(str) {
  const enc = new TextEncoder();
  const u8s = enc.encode(str);

  return Array.from(u8s)
    .map(v => String.fromCharCode(v))
    .join('');
}

function sanitizeErrorHeader(msg) {
  if (typeof msg === 'string') {
    return utf8ToAscii(msg).replace(/\r?\n|\r/g, '');
  }
  return '';
}

function failPng(res, msg, statusCode = 500) {
  res.writeHead(statusCode, {
    'Content-Type': 'image/png',
    'X-quickchart-error': sanitizeErrorHeader(msg),
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
    'X-quickchart-error': sanitizeErrorHeader(msg),
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
    'X-quickchart-error': sanitizeErrorHeader(msg),
  });
  res.end(buf);
}

function renderChartToPng(req, res, opts) {
  opts.failFn = failPng;
  opts.onRenderHandler = buf => {
    res
      .type('image/png')
      .set({
        // 1 week cache
        'Cache-Control': isDev ? 'no-cache' : 'public, max-age=604800',
      })
      .send(buf)
      .end();
  };
  doChartjsRender(req, res, opts);
}

function renderChartToSvg(req, res, opts) {
  opts.failFn = failSvg;
  opts.onRenderHandler = buf => {
    res
      .type('image/svg+xml')
      .set({
        // 1 week cache
        'Cache-Control': isDev ? 'no-cache' : 'public, max-age=604800',
      })
      .send(buf)
      .end();
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

  const width = parseInt(opts.width, 10) || 500;
  const height = parseInt(opts.height, 10) || 300;

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

  renderChartJs(
    width,
    height,
    opts.backgroundColor,
    opts.devicePixelRatio,
    opts.version || '2.9.4',
    opts.format,
    untrustedInput,
  )
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

  let converted;
  try {
    converted = toChartJs(req.query);
  } catch (err) {
    logger.error(`GChart error: Could not interpret ${req.originalUrl}`);
    res.status(500).end('Sorry, this chart configuration is not supported right now');
    return;
  }

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
    1.0 /* devicePixelRatio */,
    '2.9.4' /* version */,
    undefined /* format */,
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

app.get('/chart', (req, res) => {
  if (req.query.cht) {
    // This is a Google Image Charts-compatible request.
    handleGChart(req, res);
    return;
  }

  const outputFormat = (req.query.f || req.query.format || 'png').toLowerCase();
  const opts = {
    chart: req.query.c || req.query.chart,
    height: req.query.h || req.query.height,
    width: req.query.w || req.query.width,
    backgroundColor: req.query.backgroundColor || req.query.bkg,
    devicePixelRatio: req.query.devicePixelRatio,
    version: req.query.v || req.query.version,
    encoding: req.query.encoding || 'url',
    format: outputFormat,
  };

  if (outputFormat === 'pdf') {
    renderChartToPdf(req, res, opts);
  } else if (outputFormat === 'svg') {
    renderChartToSvg(req, res, opts);
  } else if (!outputFormat || outputFormat === 'png') {
    renderChartToPng(req, res, opts);
  } else {
    logger.error(`Request for unsupported format ${outputFormat}`);
    res.status(500).end(`Unsupported format ${outputFormat}`);
  }

  telemetry.count('chartCount');
});

app.post('/chart', (req, res) => {
  const outputFormat = (req.body.f || req.body.format || 'png').toLowerCase();
  const opts = {
    chart: req.body.c || req.body.chart,
    height: req.body.h || req.body.height,
    width: req.body.w || req.body.width,
    backgroundColor: req.body.backgroundColor || req.body.bkg,
    devicePixelRatio: req.body.devicePixelRatio,
    version: req.body.v || req.body.version,
    encoding: req.body.encoding || 'url',
    format: outputFormat,
  };

  if (outputFormat === 'pdf') {
    renderChartToPdf(req, res, opts);
  } else if (outputFormat === 'svg') {
    renderChartToSvg(req, res, opts);
  } else {
    renderChartToPng(req, res, opts);
  }

  telemetry.count('chartCount');
});

app.get('/qr', (req, res) => {
  const qrText = req.query.text;
  if (!qrText) {
    failPng(res, 'You are missing variable `text`');
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

  const qrOpts = {
    margin,
    width: size,
    errorCorrectionLevel: ecLevel,
    color: {
      dark: darkColor,
      light: lightColor,
    },
  };

  renderQr(format, mode, qrText, qrOpts)
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

app.post('/chart/create', (req, res) => {
  const { neverExpire = false } = req.body;
  const outputFormat = (req.body.f || req.body.format || 'png').toLowerCase();
  const config = {
    chart: req.body.c || req.body.chart,
    height: req.body.h || req.body.height,
    width: req.body.w || req.body.width,
    backgroundColor: req.body.backgroundColor || req.body.bkg,
    devicePixelRatio: req.body.devicePixelRatio,
    version: req.body.v || req.body.version,
    encoding: req.body.encoding || 'url',
    format: outputFormat,
  };

  if (!config.chart) {
    return res.status(400).json({ error: 'Chart config is required' });
  }

  const id = crypto.randomUUID();
  const expiresAt = neverExpire
    ? null
    : new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString();
  const configStr = JSON.stringify(config);
  db.run(
    'INSERT INTO charts (id, config, expires_at) VALUES (?, ?, ?)',
    [id, configStr, expiresAt],
    err => {
      if (err) {
        return res.status(500).json({ error: 'Failed to store chart' });
      }
      res.json({ success: true, url: `${req.protocol}://${req.get('host')}/chart/render/${id}` });
    },
  );
});

function applyTemplateOverrides(chartConfig, params) {
  if (params.title) {
    chartConfig.chart.options = chartConfig.chart.options || {};
    chartConfig.chart.options.title = chartConfig.chart.options.title || {};
    chartConfig.chart.options.title.text = params.title;
    chartConfig.chart.options.title.display = true;
  }

  if (params.labels) {
    chartConfig.chart.data.labels = params.labels.split(',');
  }

  Object.keys(params).forEach(paramKey => {
    const dataMatch = paramKey.match(/^data(\d+)$/);
    if (dataMatch) {
      const index = parseInt(dataMatch[1], 10) - 1;
      if (chartConfig.chart.data.datasets[index]) {
        chartConfig.chart.data.datasets[index].data = params[paramKey].split(',').map(Number);
      }
    }
    const backgroundColorMatch = paramKey.match(/^backgroundColor(\d+)$/);
    if (backgroundColorMatch) {
      const index = parseInt(backgroundColorMatch[1], 10) - 1;
      if (chartConfig.chart.data.datasets[index]) {
        chartConfig.chart.data.datasets[index].backgroundColor = params[paramKey]
          .split(',')
          .map(Number);
      }
    }
    const borderColorMatch = paramKey.match(/^borderColor(\d+)$/);
    if (borderColorMatch) {
      const index = parseInt(borderColorMatch[1], 10) - 1;
      if (chartConfig.chart.data.datasets[index]) {
        chartConfig.chart.data.datasets[index].borderColor = params[paramKey]
          .split(',')
          .map(Number);
      }
    }
  });
  return chartConfig;
}

app.get('/chart/render/:key', async (req, res) => {
  const { key } = req.params;

  db.get('SELECT config FROM charts WHERE id = ?', [key], function(err, row) {
    if (err) {
      res.status(500).json({ error: err.message });
    }

    if (!row) {
      return res.status(404).json({ error: 'Template not found' });
    }
    //return res.status(200).json({status: 'success'});
    let chartConfig = JSON.parse(row.config);
    chartConfig = applyTemplateOverrides(chartConfig, req.query);
    if (chartConfig.format === 'pdf') {
      renderChartToPdf(req, res, chartConfig);
    } else if (chartConfig.format === 'svg') {
      renderChartToSvg(req, res, chartConfig);
    } else if (!chartConfig.format || chartConfig.format === 'png') {
      renderChartToPng(req, res, chartConfig);
    } else {
      logger.error(`Request for unsupported format ${outputFormat}`);
      res.status(500).end(`Unsupported format ${outputFormat}`);
    }

    telemetry.count('chartCount');
  });
});

setInterval(() => {
  db.run("DELETE FROM charts WHERE expires_at IS NOT NULL AND expires_at < datetime('now')");
}, 24 * 60 * 60 * 1000);

const port = process.env.PORT || 3400;
const server = app.listen(port);

const timeout = parseInt(process.env.REQUEST_TIMEOUT_MS, 10) || 5000;
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
