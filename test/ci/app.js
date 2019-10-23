/* eslint-env node, mocha */

const ColorThief = require('color-thief');
const assert = require('assert');
const imageSize = require('image-size');
const request = require('supertest');

const app = require('../../index');
const { BASIC_CHART, JS_CHART } = require('./chart_helpers');

const colorThief = new ColorThief();

function almostEqualNumbers(x, y, tolerance) {
  return Math.abs(x - y) <= tolerance;
}

describe('chart requests', () => {
  it('return a basic chart via GET', done => {
    request(app)
      .get(`/chart?c=${encodeURIComponent(JSON.stringify(BASIC_CHART))}`)
      .expect('Content-Type', 'image/png')
      .expect(200)
      .end((err, res) => {
        const dimensions = imageSize(res.body);
        assert.equal(500 * 2, dimensions.width);
        assert.equal(300 * 2, dimensions.height);
        done();
      });
  });

  it('return an JS chart via GET', done => {
    request(app)
      .get(`/chart?c=${encodeURIComponent(JS_CHART)}`)
      .expect('Content-Type', 'image/png')
      .expect(200)
      .end((err, res) => {
        const dimensions = imageSize(res.body);
        assert.equal(500 * 2, dimensions.width);
        assert.equal(300 * 2, dimensions.height);
        done();
      });
  });

  it('return a basic chart via GET with parameters', done => {
    request(app)
      .get(
        `/chart?c=${encodeURIComponent(
          JSON.stringify(BASIC_CHART),
        )}&width=200&height=100&devicePixelRatio=1&backgroundColor=rgb(249, 193, 202)`,
      )
      .expect('Content-Type', 'image/png')
      .expect(200)
      .end((err, res) => {
        const rgb = colorThief.getColor(res.body);
        assert(almostEqualNumbers(249, rgb[0], 1));
        assert(almostEqualNumbers(193, rgb[1], 1));
        assert(almostEqualNumbers(202, rgb[2], 1));

        const dimensions = imageSize(res.body);
        assert.equal(200, dimensions.width);
        assert.equal(100, dimensions.height);
        done();
      });
  });

  it('return a basic chart via POST', done => {
    request(app)
      .post('/chart')
      .send({
        chart: BASIC_CHART,
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

  it('return an advanced chart via POST', done => {
    request(app)
      .post('/chart')
      .send({
        chart: JS_CHART,
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

  it('return an advanced chart via POST with parameters', done => {
    request(app)
      .post('/chart')
      .send({
        chart: JS_CHART,
        width: 456,
        height: 123,
        devicePixelRatio: 1.0,
        backgroundColor: 'rgb(90, 80, 70)',
      })
      .expect('Content-Type', 'image/png')
      .expect(200)
      .end((err, res) => {
        const rgb = colorThief.getColor(res.body);
        assert(almostEqualNumbers(90, rgb[0], 3));
        assert(almostEqualNumbers(80, rgb[1], 3));
        assert(almostEqualNumbers(70, rgb[2], 3));

        const dimensions = imageSize(res.body);
        assert.equal(456, dimensions.width);
        assert.equal(123, dimensions.height);
        done();
      });
  });
});
