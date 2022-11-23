/* eslint-env node, mocha */

const assert = require('assert');
const crypto = require('crypto');

const getColors = require('get-image-colors');
const imageSize = require('image-size');
const request = require('supertest');

const app = require('../../index');
const { BASIC_CHART, JS_CHART } = require('./chart_helpers');
const { assertSimilarRgb } = require('./color_helpers');
const { getQrValue } = require('./qr_helpers');

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
      .end(async (err, res) => {
        const rgb = (await getColors(res.body, 'image/png'))[0].rgb();
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
      .end(async (err, res) => {
        const rgb = (await getColors(res.body, 'image/png'))[0].rgb();
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
      .end(async (err, res) => {
        const rgb = (await getColors(res.body, 'image/png'))[0].rgb();
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
      .end(async (err, res) => {
        const rgb = (await getColors(res.body, 'image/png'))[0].rgb();
        // Image is transparent by default - expect dominant color to be blue
        // bars.
        assertSimilarRgb([76, 124, 164], rgb);

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
      .end(async (err, res) => {
        const dimensions = imageSize(res.body);
        assert.equal(150, dimensions.width);
        assert.equal(150, dimensions.height);

        const result = await getQrValue(res.body);
        assert.equal(qrText, result);
        done();
      });
  });

  it('renders basic qr - google image charts compatible', done => {
    const qrPublicUrl = '/chart?chs=300x300&cht=qr&chl=Hola mundo&choe=UTF-8&chld=M|10';
    request(app)
      .get(qrPublicUrl)
      .expect('Content-Type', 'image/png')
      .expect(200)
      .end(async (err, res) => {
        const dimensions = imageSize(res.body);
        assert.equal(300, dimensions.width);
        assert.equal(300, dimensions.height);

        const result = await getQrValue(res.body);
        assert.equal('Hola mundo', result);
        done();
      });
  });
});

describe('graphviz endpoint', () => {
  it('renders graphviz png', done => {
    const graphStr =
      'digraph{C_0[shape=box];C_0->H_0[type=s];C_0->H_1[type=s];C_0->H_2[type=s];C_0->C_1[type=s];C_1->H_3[type=s];C_1->H_4[type=s];C_1->H_5[color=blue]}';
    const url = `/chart?cht=gv&chl=${graphStr}&chs=500x200&chof=png`;
    request(app)
      .get(url)
      .expect('Content-Type', 'image/png')
      .expect(200)
      .end((err, res) => {
        const dimensions = imageSize(res.body);
        assert.equal(500, dimensions.width);
        assert.equal(200, dimensions.height);
        done();
      });
  });

  it('renders graphviz svg', done => {
    const graphStr =
      'digraph{C_0[shape=box];C_0->H_0[type=s];C_0->H_1[type=s];C_0->H_2[type=s];C_0->C_1[type=s];C_1->H_3[type=s];C_1->H_4[type=s];C_1->H_5[color=blue]}';
    const url = `/chart?cht=gv&chl=${graphStr}`;
    request(app)
      .get(url)
      .expect('Content-Type', 'image/svg+xml')
      .expect(200)
      .end((err, res) => {
        assert(res.body.indexOf('<g id="node2" class="node">') > -1);
        done();
      });
  });
});
