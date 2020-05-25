/* eslint-env node, mocha */

const assert = require('assert');
const imageSize = require('image-size');

const { renderQr, DEFAULT_QR_SIZE } = require('../../lib/qr');

describe('qr code rendering', () => {
  it('renders a basic QR svg', async () => {
    const buf = await renderQr('svg', undefined /* mode */, 'hello world', {});
    assert(buf.length > 0);
    assert(buf.toString().indexOf('M4 4.5h7m2 0h1m1 0h2m1') > -1);
  });

  it('renders a basic QR png', async () => {
    const buf = await renderQr('png', undefined /* mode */, 'hello world', {
      width: 150,
    });
    assert(buf.length > 0);

    const dimensions = imageSize(buf);
    assert.equal(150, dimensions.width);
    assert.equal(150, dimensions.height);
  });
});
