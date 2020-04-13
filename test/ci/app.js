/* eslint-env node, mocha */

const assert = require('assert');
const crypto = require('crypto');

const ColorThief = require('color-thief');
const imageSize = require('image-size');
const request = require('supertest');

const app = require('../../index');
const { addKeyLine } = require('../../api_keys');
const { BASIC_CHART, JS_CHART } = require('./chart_helpers');
const { deltaE } = require('./color_helpers');

const colorThief = new ColorThief();

function assertSimilarRgb(expected, actual, tolerance = 6) {
  const diff = deltaE(expected, actual);
  if (diff > tolerance) {
    throw new Error(
      `Expected rgb ${expected} but got ${actual}, scored at diff=${diff} which is greater than ${tolerance}`,
    );
  }
}

describe('chart request', () => {
  it('returns a basic chart via GET', done => {
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

  it('returns a basic chart via GET, base64 encoded', done => {
    request(app)
      .get(
        `/chart?c=${Buffer.from(JSON.stringify(BASIC_CHART)).toString('base64')}&encoding=base64`,
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

  it('returns a basic chart via GET with parameters', done => {
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

  it('returns a basic chart via POST, base64 encoded', done => {
    request(app)
      .post('/chart')
      .send({
        chart: Buffer.from(JSON.stringify(BASIC_CHART)).toString('base64'),
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

  it('returns an advanced chart via POST with parameters', done => {
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
        chart: Buffer.from(JS_CHART).toString('base64'),
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
        chart: BASIC_CHART,
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

describe('qr endpoint', () => {
  it('renders basic qr', done => {
    const qrText = 'hello werld';
    const qrPublicUrl = `/qr?text=${encodeURIComponent(qrText)}`;
    request(app)
      .get(qrPublicUrl)
      .expect('Content-Type', 'image/png')
      .expect(200)
      .end((err, res) => {
        const dimensions = imageSize(res.body);
        assert.equal(150, dimensions.width);
        assert.equal(150, dimensions.height);
        done();
      });
  });
});

describe('authentication', () => {
  it('rejects unknown qr signature', done => {
    const ACCOUNT_ID = '12345';
    const API_KEY = 'abc123';

    // Generate a URL for QR code
    const qrText = 'Hello world';
    const qrSignedParam = crypto
      .createHmac('sha256', API_KEY + 'x')
      .update(qrText)
      .digest('hex');

    const qrPublicUrl = `/qr?text=${encodeURIComponent(
      qrText,
    )}&sig=${qrSignedParam}&accountId=${ACCOUNT_ID}`;
    request(app)
      .get(qrPublicUrl)
      .expect('Content-Type', 'image/png')
      .expect(403)
      .end(done);
  });

  it('accepts known qr signature', done => {
    addKeyLine('abc123:12345');

    const ACCOUNT_ID = '12345';
    const API_KEY = 'abc123';

    const qrText = 'Hello world';
    const qrSignedParam = crypto
      .createHmac('sha256', API_KEY)
      .update(qrText)
      .digest('hex');

    const qrPublicUrl = `/qr?text=${encodeURIComponent(
      qrText,
    )}&sig=${qrSignedParam}&accountId=${ACCOUNT_ID}`;
    request(app)
      .get(qrPublicUrl)
      .expect('Content-Type', 'image/png')
      .expect(200)
      .end((err, res) => {
        const dimensions = imageSize(res.body);
        assert.equal(150, dimensions.width);
        assert.equal(150, dimensions.height);
        done();
      });
  });

  it('rejects unknown chart signature', done => {
    const ACCOUNT_ID = '5678';
    const API_KEY = 'xyz123';

    const chartObj = JSON.stringify({
      type: 'bar',
      data: {
        labels: ['January', 'February', 'March', 'April', 'May'],
        datasets: [
          { label: 'Dogs', data: [50, 60, 70, 180, 190] },
          { label: 'Cats', data: [100, 200, 300, 400, 500] },
        ],
      },
    });
    const chartSignedParam = crypto
      .createHmac('sha256', API_KEY)
      .update(chartObj)
      .digest('hex');

    const chartPublicUrl = `/chart?chart=${chartObj}&sig=${chartSignedParam}&accountId=${ACCOUNT_ID}`;
    request(app)
      .get(chartPublicUrl)
      .expect('Content-Type', 'image/png')
      .expect(403)
      .end(done);
  });

  it('accepts known chart signature', done => {
    addKeyLine('xyz123:5678');

    const ACCOUNT_ID = '5678';
    const API_KEY = 'xyz123';

    const chartObj = JSON.stringify({
      type: 'bar',
      data: {
        labels: ['January', 'February', 'March', 'April', 'May'],
        datasets: [
          { label: 'Dogs', data: [50, 60, 70, 180, 190] },
          { label: 'Cats', data: [100, 200, 300, 400, 500] },
        ],
      },
    });
    const chartSignedParam = crypto
      .createHmac('sha256', API_KEY)
      .update(chartObj)
      .digest('hex');

    const chartPublicUrl = `/chart?chart=${chartObj}&sig=${chartSignedParam}&accountId=${ACCOUNT_ID}`;
    request(app)
      .get(chartPublicUrl)
      .expect('Content-Type', 'image/png')
      .expect(200)
      .end((err, res) => {
        const dimensions = imageSize(res.body);
        assert.equal(1000, dimensions.width);
        assert.equal(600, dimensions.height);
        done();
      });
  });
});
