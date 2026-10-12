/* eslint-env node, mocha */

const assert = require('assert');
const request = require('supertest');
const { CanvasRenderService } = require('chartjs-node-canvas');

const app = require('../../index');
const { logger } = require('../../logging');
const { renderChartJs } = require('../../lib/charts');
const { ChartConfigError } = require('../../lib/chart_config');

function render(chart, version = '2.9.4') {
  return renderChartJs(120, 80, 'white', 1, version, 'png', chart);
}

describe('chart configuration validation', () => {
  const invalidInputs = [
    ['raw Mermaid', 'graph TD; A --> B'],
    ['quoted Mermaid', '"graph TD; A --> B"'],
    ['quoted Graphviz', '"digraph { A -> B }"'],
    ['computed string', '(() => "graph TD; A --> B")()'],
    ['null expression', 'null'],
    ['undefined expression', 'undefined'],
    ['number expression', '42'],
    ['boolean expression', 'true'],
    ['array expression', '[]'],
    ['function expression', '(() => {})'],
    ['boxed string', 'new String("graph TD; A --> B")'],
    ['date expression', 'new Date()'],
    ['promise expression', 'Promise.resolve({type: "bar"})'],
    ['null object', null],
    ['number object', 42],
    ['boolean object', true],
    ['array object', []],
    ['string data', { type: 'bar', data: 'graph TD; A --> B' }],
    ['array data', { type: 'bar', data: [] }],
    ['string datasets', { type: 'bar', data: { datasets: 'bad' } }],
    ['object datasets', { type: 'bar', data: { datasets: {} } }],
    ['string dataset', { type: 'pie', data: { datasets: ['bad'] } }],
    ['null dataset', { type: 'line', data: { datasets: [null] } }],
    ['array dataset', { type: 'bar', data: { datasets: [[]] } }],
    ['string labels', { type: 'bar', data: { labels: 'bad' } }],
    ['string options', { type: 'bar', options: 'bad' }],
    ['array options', { type: 'bar', options: [] }],
    ['object plugins', { type: 'bar', plugins: {} }],
    ['string plugin options', { type: 'bar', options: { plugins: 'bad' } }],
    ['non-string chart type', { type: 42 }],
    ['blank chart type', { type: '' }],
    ['non-string dataset type', { data: { datasets: [{ type: 42 }] } }],
    ['empty sparkline', { type: 'sparkline' }],
    ['empty progress bar', { type: 'progressBar' }],
    ['non-array sparkline data', { type: 'sparkline', data: { datasets: [{ data: {} }] } }],
    ['browser reference during evaluation', '({ type: window.chartType })'],
    ['throwing null during evaluation', '(() => { throw null; })()'],
    ['throwing undefined during evaluation', '(() => { throw undefined; })()'],
  ];

  invalidInputs.forEach(([name, input]) => {
    it(`rejects ${name} as client input`, async () => {
      await assert.rejects(render(input), ChartConfigError);
    });
  });

  ['2.9.4', '3', '4'].forEach(version => {
    it(`rejects unknown and missing effective chart types in v${version}`, async () => {
      const Chart =
        version === '2.9.4'
          ? require('chart.js')
          : version === '3'
          ? require('chart.js-v3')
          : (await import('chart.js-v4/auto')).Chart;
      const instances = Object.keys(Chart.instances);
      for (const chart of [
        { type: 'notAChart', data: { datasets: [{ data: [1] }] } },
        { type: 'bar', data: { datasets: [{ type: 'notAChart', data: [1] }] } },
        { data: { datasets: [{ data: [1] }] } },
      ]) {
        await assert.rejects(render(chart, version), ChartConfigError);
        assert.deepStrictEqual(Object.keys(Chart.instances), instances);
      }
    });

    it(`preserves computed configs and callbacks in v${version}`, async () => {
      const input = `(() => ({
        type: 'bar',
        data: { labels: ['A'], datasets: [{ data: [1, 2].map(x => x * 2) }] },
        options: { scales: ${
          version === '2.9.4'
            ? "{ yAxes: [{ ticks: { callback: x => '$' + x } }] }"
            : "{ y: { ticks: { callback: x => '$' + x } } }"
        } },
        plugins: [{ id: 'callback-check', beforeDraw: chart => {
          if (chart.data.datasets[0].data[0] !== 2) throw new Error('Callback lost');
        } }]
      }))()`;
      const buf = await render(input, version);
      assert(buf.length > 0);
    });

    it(`allows mixed charts with dataset-level types in v${version}`, async () => {
      const buf = await render(
        {
          options: { scales: version === '2.9.4' ? { xAxes: [{}], yAxes: [{}] } : {} },
          data: {
            labels: ['A'],
            datasets: [
              { type: 'bar', data: [1] },
              { type: 'line', data: [2] },
            ],
          },
        },
        version,
      );
      assert(buf.length > 0);
    });
  });

  it('provides a resolved Chart helper to JavaScript expressions', async () => {
    const buf = await render(`({
      type: 'bar',
      data: { labels: ['A'], datasets: [{ data: [Chart.helpers.isArray([]) ? 1 : 0] }] }
    })`);
    assert(buf.length > 0);
  });

  it('allows inline plugins to register a custom controller', async () => {
    const Chart = require('chart.js');
    try {
      const buf = await render({
        type: 'bar',
        data: { labels: ['A'], datasets: [{ type: 'validationTestBar', data: [1] }] },
        plugins: [
          {
            beforeInit: () => {
              Chart.controllers.validationTestBar = Chart.controllers.bar;
            },
          },
        ],
      });
      assert(buf.length > 0);
    } finally {
      delete Chart.controllers.validationTestBar;
    }
  });

  it('allows omitted data and null defaults on empty charts', async () => {
    for (const chart of [{ type: 'pie' }, { type: 'bar', data: null, options: null }]) {
      const buf = await render(chart);
      assert(buf.length > 0);
    }
  });

  it('preserves object-map dataset data in Chart.js 3', async () => {
    const buf = await render({ type: 'bar', data: { datasets: [{ data: { A: 1, B: 2 } }] } }, '3');
    assert(buf.length > 0);
  });

  it('keeps server-side animation disabled by the renderer', async () => {
    const buf = await render({
      type: 'bar',
      data: { labels: ['A'], datasets: [{ data: [1] }] },
      options: { animation: { duration: 1000 } },
    });
    assert(buf.length > 0);
  });
});

describe('chart validation responses and logging', () => {
  let originalLoggers;
  let logs;
  beforeEach(() => {
    logs = [];
    originalLoggers = {};
    ['info', 'warn', 'error'].forEach(level => {
      originalLoggers[level] = logger[level];
      logger[level] = (...args) => logs.push({ level, args });
    });
  });
  afterEach(() => {
    Object.keys(originalLoggers).forEach(level => {
      logger[level] = originalLoggers[level];
    });
  });

  ['png', 'svg', 'pdf'].forEach(format => {
    ['get', 'post'].forEach(method => {
      it(`returns a useful 400 for ${method.toUpperCase()} ${format} without error logs`, async () => {
        const params = { chart: '"graph TD; A --> B"', format };
        const req = request(app)[method]('/chart');
        const res = await (method === 'get' ? req.query(params) : req.send(params)).expect(400);
        assert(res.headers['x-quickchart-error'].includes('expected an object'));
        const contentTypes = { png: 'image/png', svg: 'image/svg+xml', pdf: 'application/pdf' };
        assert.equal(res.headers['content-type'], contentTypes[format]);
        assert.deepStrictEqual(logs, [
          {
            level: 'info',
            args: [{ code: 'INVALID_CHART_CONFIG' }, 'Chart configuration rejected'],
          },
        ]);
      });
    });
  });

  it('classifies JSON body shapes, syntax errors, references, and invalid chart types', async () => {
    for (const chart of [
      { type: 'bar', data: 'bad' },
      { type: 'chart', data: { datasets: [{ data: [1] }] } },
      'graph TD; A --> B',
      '({type: window.chartType})',
    ]) {
      await request(app)
        .post('/chart')
        .send({ chart })
        .expect(400);
    }
    assert(logs.every(log => log.level === 'info'));
    assert(!JSON.stringify(logs).includes('stack'));
    assert(!JSON.stringify(logs).includes('graph TD'));
  });

  it('validates base64-decoded configurations', async () => {
    await request(app)
      .get('/chart')
      .query({
        chart: Buffer.from('"graph TD; A --> B"').toString('base64'),
        encoding: 'base64',
      })
      .expect(400);
    assert(logs.every(log => log.level === 'info'));
    await request(app)
      .post('/chart')
      .send({ chart: {}, encoding: 'base64' })
      .expect(400);
  });

  it('returns 400 for missing configs in every output format', async () => {
    for (const format of ['png', 'svg', 'pdf']) {
      const res = await request(app)
        .get('/chart')
        .query({ format })
        .expect(400);
      assert(res.headers['x-quickchart-error'].includes('missing variable'));
    }
  });

  it('escapes evaluation error text in SVG responses', async () => {
    const res = await request(app)
      .get('/chart')
      .query({
        chart: '(() => { throw new Error("<script>alert(1)</script>"); })()',
        format: 'svg',
      })
      .expect(400);
    const body = Buffer.isBuffer(res.body) ? res.body.toString() : res.text;
    assert(!body.includes('<script>'));
    assert(body.includes('&lt;script&gt;'));
  });

  it('keeps unexpected renderer failures as 500 and logs the error', async () => {
    const original = CanvasRenderService.prototype.renderToBuffer;
    const failure = new Error('Synthetic renderer failure');
    CanvasRenderService.prototype.renderToBuffer = () => Promise.reject(failure);
    try {
      await request(app)
        .post('/chart')
        .send({ chart: { type: 'bar' } })
        .expect(500);
      assert.equal(logs.length, 1);
      assert.equal(logs[0].level, 'error');
      assert.strictEqual(logs[0].args[0], failure);
    } finally {
      CanvasRenderService.prototype.renderToBuffer = original;
    }
  });

  it('does not blanket-reclassify runtime ReferenceErrors from callbacks', async () => {
    await request(app)
      .post('/chart')
      .send({
        chart: `({ type: 'bar', data: { datasets: [{ data: [1] }] },
        plugins: [{ beforeDraw: () => { throw new ReferenceError('window is not defined'); } }] })`,
      })
      .expect(500);
    assert.equal(logs[0].level, 'error');
  });
});
