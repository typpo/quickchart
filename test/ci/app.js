/* eslint-env node, mocha */

const ColorThief = require('color-thief');
const assert = require('assert');
const imageSize = require('image-size');
const request = require('supertest');

const app = require('../../index');
const { getBasicChart, getJsChart } = require('./chart_helpers');
const { assertSimilarRgb } = require('./color_helpers');

const colorThief = new ColorThief();

describe('chart request', () => {
  it('returns a basic chart via GET', done => {
    request(app)
      .get(`/chart?c=${encodeURIComponent(JSON.stringify(getBasicChart()))}`)
      .expect('Content-Type', 'image/png')
      .expect(200)
      .end((err, res) => {
        const dimensions = imageSize(res.body);
        assert.equal(500 * 2, dimensions.width);
        assert.equal(300 * 2, dimensions.height);
        done();
      });
  });

  it('returns a basic chart via GET with color wheel', done => {
    const url = `/chart?defaultColors=${encodeURIComponent(
      '["purple"]',
    )}&bkg=white&c=${encodeURIComponent(JSON.stringify(getBasicChart()))}`;
    console.log(url);
    request(app)
      .get(url)
      .expect('Content-Type', 'image/png')
      .expect(200)
      .end((err, res) => {
        const rgb = colorThief.getColor(res.body);

        assertSimilarRgb([214, 208, 214], rgb);
        done();
      });
  });

  it('returns a basic chart via GET, base64 encoded', done => {
    request(app)
      .get(
        `/chart?c=${Buffer.from(JSON.stringify(getBasicChart())).toString(
          'base64',
        )}&encoding=base64`,
      )
      .expect('Content-Type', 'image/png')
      .expect(200)
      .end((err, res) => {
        const dimensions = imageSize(res.body);
        assert.equal(500 * 2, dimensions.width);
        assert.equal(300 * 2, dimensions.height);
        done();
      });
  });

  it('returns an JS chart via GET', done => {
    request(app)
      .get(`/chart?c=${encodeURIComponent(getJsChart())}`)
      .expect('Content-Type', 'image/png')
      .expect(200)
      .end((err, res) => {
        const dimensions = imageSize(res.body);
        assert.equal(500 * 2, dimensions.width);
        assert.equal(300 * 2, dimensions.height);
        done();
      });
  });

  it('returns a basic chart via GET with parameters', done => {
    request(app)
      .get(
        `/chart?c=${encodeURIComponent(
          JSON.stringify(getBasicChart()),
        )}&width=200&height=100&devicePixelRatio=1&backgroundColor=rgb(249, 193, 202)`,
      )
      .expect('Content-Type', 'image/png')
      .expect(200)
      .end((err, res) => {
        const rgb = colorThief.getColor(res.body);
        assertSimilarRgb([249, 193, 202], rgb);

        const dimensions = imageSize(res.body);
        assert.equal(200, dimensions.width);
        assert.equal(100, dimensions.height);
        done();
      });
  });

  it('returns a basic chart via POST', done => {
    request(app)
      .post('/chart')
      .send({
        chart: getBasicChart(),
      })
      .expect('Content-Type', 'image/png')
      .expect(200)
      .end((err, res) => {
        const dimensions = imageSize(res.body);
        assert.equal(500 * 2, dimensions.width);
        assert.equal(300 * 2, dimensions.height);
        done();
      });
  });

  it('returns a basic chart via POST, base64 encoded', done => {
    request(app)
      .post('/chart')
      .send({
        chart: Buffer.from(JSON.stringify(getBasicChart())).toString('base64'),
        encoding: 'base64',
      })
      .expect('Content-Type', 'image/png')
      .expect(200)
      .end((err, res) => {
        const dimensions = imageSize(res.body);
        assert.equal(500 * 2, dimensions.width);
        assert.equal(300 * 2, dimensions.height);
        done();
      });
  });

  it('returns an advanced chart via POST', done => {
    request(app)
      .post('/chart')
      .send({
        chart: getJsChart(),
      })
      .expect('Content-Type', 'image/png')
      .expect(200)
      .end((err, res) => {
        const dimensions = imageSize(res.body);
        assert.equal(500 * 2, dimensions.width);
        assert.equal(300 * 2, dimensions.height);
        done();
      });
  });

  it('returns an advanced chart via POST with parameters', done => {
    request(app)
      .post('/chart')
      .send({
        chart: getJsChart(),
        width: 456,
        height: 123,
        devicePixelRatio: 1.0,
        backgroundColor: 'rgb(90, 80, 70)',
      })
      .expect('Content-Type', 'image/png')
      .expect(200)
      .end((err, res) => {
        const rgb = colorThief.getColor(res.body);
        assertSimilarRgb([90, 80, 70], rgb);

        const dimensions = imageSize(res.body);
        assert.equal(456, dimensions.width);
        assert.equal(123, dimensions.height);
        done();
      });
  });

  it('returns an advanced chart via POST with parameters and base 64', done => {
    request(app)
      .post('/chart')
      .send({
        chart: Buffer.from(getJsChart()).toString('base64'),
        width: 369,
        height: 150,
        devicePixelRatio: 1.0,
        backgroundColor: 'rgb(190, 180, 170)',
        encoding: 'base64',
      })
      .expect('Content-Type', 'image/png')
      .expect(200)
      .end((err, res) => {
        const rgb = colorThief.getColor(res.body);
        assertSimilarRgb([190, 180, 170], rgb);

        const dimensions = imageSize(res.body);
        assert.equal(369, dimensions.width);
        assert.equal(150, dimensions.height);
        done();
      });
  });

  it('reverts correctly to background transparency', done => {
    // Don't let background selection stick between requests.
    request(app)
      .post('/chart')
      .send({
        chart: getBasicChart(),
      })
      .expect('Content-Type', 'image/png')
      .expect(200)
      .end((err, res) => {
        const rgb = colorThief.getColor(res.body);
        // Image is transparent by default - expect dominant color to be blue
        // bars.
        assertSimilarRgb([76, 140, 252], rgb);

        const dimensions = imageSize(res.body);
        assert.equal(500 * 2, dimensions.width);
        assert.equal(300 * 2, dimensions.height);
        done();
      });
  });
});
