/* eslint-env node, mocha */

const assert = require('assert');

const ColorThief = require('color-thief');
const imageSize = require('image-size');

const chartsLib = require('../../lib/charts');
const charts = require('./chart_helpers');
const { assertSimilarRgb } = require('./color_helpers');

const colorThief = new ColorThief();

describe('charts.js', () => {
  it('renders a JSON chart', async () => {
    const buf = await chartsLib.renderChartJs(200, 100, 'white', 1.0, '2.9.4', charts.BASIC_CHART);

    assert(buf.length > 0);
    const dimensions = imageSize(buf);
    // Device pixel ratio is 2.0, so multiply dimensions by that.
    assert.equal(200, dimensions.width);
    assert.equal(100, dimensions.height);
  });

  it('renders a JSON chart in Chart.js V3', async () => {
    const buf = await chartsLib.renderChartJs(200, 100, 'white', 1.0, '3', charts.BASIC_CHART_V3);

    assert(buf.length > 0);
    const dimensions = imageSize(buf);
    // Device pixel ratio is 2.0, so multiply dimensions by that.
    assert.equal(200, dimensions.width);
    assert.equal(100, dimensions.height);
  });

  it('adjusts chart size based on device pixel ratio', async () => {
    const buf = await chartsLib.renderChartJs(200, 100, 'white', 2.0, '2.9.4', charts.BASIC_CHART);

    assert(buf.length > 0);
    const dimensions = imageSize(buf);
    // Device pixel ratio is 2.0, so multiply dimensions by that.
    assert.equal(200 * 2, dimensions.width);
    assert.equal(100 * 2, dimensions.height);
  });

  it('renders a JS chart', async () => {
    const buf = await chartsLib.renderChartJs(200, 100, 'white', 2.0, '2.9.4', charts.JS_CHART);
    assert(buf.length > 0);
  });

  it('renders a chart color scheme', async () => {
    const buf = await chartsLib.renderChartJs(
      200,
      100,
      'white',
      2.0,
      '2.9.4',
      charts.CHART_COLOR_SCHEME,
    );
    const rgb = colorThief.getColor(buf);
    assertSimilarRgb([156, 156, 252], rgb);
  });

  it('renders a chart with gradient fill', async () => {
    const buf = await chartsLib.renderChartJs(
      300,
      200,
      'white',
      2.0,
      '2.9.4',
      charts.CHART_GRADIENT_FILL,
    );
    const rgb = colorThief.getColor(buf);
    assertSimilarRgb([172, 58, 199], rgb);
  });

  it('renders a violin chart', async () => {
    const buf = await chartsLib.renderChartJs(300, 200, 'white', 2.0, '2.9.4', charts.CHART_VIOLIN);
    const dimensions = imageSize(buf);
    assert.equal(600, dimensions.width);
    assert.equal(400, dimensions.height);
  });

  it('renders a progress bar', async () => {
    const buf = await chartsLib.renderChartJs(
      100,
      50,
      'white',
      2.0,
      '2.9.4',
      charts.CHART_PROGRESSBAR,
    );
    const rgb = colorThief.getColor(buf);
    assertSimilarRgb([76, 124, 164], rgb);
  });

  it('renders a datetime chart in Chart.js V3', async () => {
    const buf = await chartsLib.renderChartJs(200, 100, 'white', 1.0, '3', charts.DATETIME_V3);

    assert(buf.length > 0);
    const dimensions = imageSize(buf);
    // Device pixel ratio is 2.0, so multiply dimensions by that.
    assert.equal(200, dimensions.width);
    assert.equal(100, dimensions.height);
  });
});
