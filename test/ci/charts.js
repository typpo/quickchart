/* eslint-env node, mocha */

const assert = require('assert');

const getColors = require('get-image-colors');
const imageSize = require('image-size');

const chartsLib = require('../../lib/charts');
const charts = require('./chart_helpers');
const { assertSimilarRgb } = require('./color_helpers');

describe('charts.js', () => {
  it('renders a JSON chart', async () => {
    const buf = await chartsLib.renderChartJs(
      200,
      100,
      'white',
      1.0,
      '2.9.4',
      'png',
      charts.BASIC_CHART,
    );

    assert(buf.length > 0);
    const dimensions = imageSize(buf);
    // Device pixel ratio is 2.0, so multiply dimensions by that.
    assert.equal(200, dimensions.width);
    assert.equal(100, dimensions.height);
  });

  it('renders a JSON chart in Chart.js V3', async () => {
    const buf = await chartsLib.renderChartJs(
      200,
      100,
      'white',
      1.0,
      '3',
      'png',
      charts.BASIC_CHART_V3,
    );

    assert(buf.length > 0);
    const dimensions = imageSize(buf);
    // Device pixel ratio is 2.0, so multiply dimensions by that.
    assert.equal(200, dimensions.width);
    assert.equal(100, dimensions.height);
  });

  it('adjusts chart size based on device pixel ratio', async () => {
    const buf = await chartsLib.renderChartJs(
      200,
      100,
      'white',
      2.0,
      '2.9.4',
      'png',
      charts.BASIC_CHART,
    );

    assert(buf.length > 0);
    const dimensions = imageSize(buf);
    // Device pixel ratio is 2.0, so multiply dimensions by that.
    assert.equal(200 * 2, dimensions.width);
    assert.equal(100 * 2, dimensions.height);
  });

  it('renders a JS chart', async () => {
    const buf = await chartsLib.renderChartJs(
      200,
      100,
      'white',
      2.0,
      '2.9.4',
      'png',
      charts.JS_CHART,
    );
    assert(buf.length > 0);
  });

  it('renders a chart color scheme', async () => {
    const buf = await chartsLib.renderChartJs(
      200,
      100,
      'white',
      2.0,
      '2.9.4',
      'png',
      charts.CHART_COLOR_SCHEME,
    );
    const rgb = (await getColors(buf, 'image/png'))[0].rgb();
    assertSimilarRgb([156, 156, 252], rgb);
  });

  it('renders a chart with gradient fill', async () => {
    const buf = await chartsLib.renderChartJs(
      300,
      200,
      'transparent',
      2.0,
      '2.9.4',
      'png',
      charts.CHART_GRADIENT_FILL,
    );
    const rgb = (await getColors(buf, 'image/png'))[0].rgb();
    assertSimilarRgb([172, 58, 199], rgb);
  });

  it('renders a violin chart', async () => {
    const buf = await chartsLib.renderChartJs(
      300,
      200,
      'white',
      2.0,
      '2.9.4',
      'png',
      charts.CHART_VIOLIN,
    );
    const dimensions = imageSize(buf);
    assert.equal(600, dimensions.width);
    assert.equal(400, dimensions.height);
  });

  it('renders a progress bar', async () => {
    const buf = await chartsLib.renderChartJs(
      500,
      50,
      'red',
      2.0,
      '2.9.4',
      'png',
      charts.CHART_PROGRESSBAR,
    );
    const rgb = (await getColors(buf, 'image/png'))[2].rgb();
    assertSimilarRgb([76, 124, 164], rgb);
  });

  it('renders a datetime chart in Chart.js V3', async () => {
    const buf = await chartsLib.renderChartJs(
      200,
      100,
      'white',
      1.0,
      '3',
      'png',
      charts.DATETIME_V3,
    );

    assert(buf.length > 0);
    const dimensions = imageSize(buf);
    // Device pixel ratio is 2.0, so multiply dimensions by that.
    assert.equal(200, dimensions.width);
    assert.equal(100, dimensions.height);
  });

  it('renders a basic chart svg', async () => {
    const buf = await chartsLib.renderChartJs(
      500,
      300,
      'white',
      1.0,
      '2.9.4',
      'svg',
      charts.BASIC_CHART,
    );

    // Check if it's a valid SVG
    assert(buf.toString().includes('<svg'));
    assert(buf.toString().includes('</svg>'));

    // Just verify it has some path elements as a basic check
    assert(buf.toString().includes('<path'));
  });
});
