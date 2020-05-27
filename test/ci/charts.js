/* eslint-env node, mocha */

const assert = require('assert');
const imageSize = require('image-size');

const chartsLib = require('../../lib/charts');
const { BASIC_CHART, JS_CHART } = require('./chart_helpers');

describe('charts.js', () => {
  it('renders a JSON chart', async () => {
    const buf = await chartsLib.renderChartJs(200, 100, 'white', 1.0, BASIC_CHART);

    assert(buf.length > 0);
    const dimensions = imageSize(buf);
    // Device pixel ratio is 2.0, so multiply dimensions by that.
    assert.equal(200, dimensions.width);
    assert.equal(100, dimensions.height);
  });

  it('adjusts chart size based on device pixel ratio', async () => {
    const buf = await chartsLib.renderChartJs(200, 100, 'white', 2.0, BASIC_CHART);

    assert(buf.length > 0);
    const dimensions = imageSize(buf);
    // Device pixel ratio is 2.0, so multiply dimensions by that.
    assert.equal(200 * 2, dimensions.width);
    assert.equal(100 * 2, dimensions.height);
  });

  it('renders a JS chart', async () => {
    const buf = await chartsLib.renderChartJs(200, 100, 'white', 2.0, JS_CHART);
    assert(buf.length > 0);
  });
});
