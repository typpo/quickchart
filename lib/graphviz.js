const sharp = require('sharp');
const Viz = require('viz.js');
const { Module, render } = require('viz.js/full.render.js');

async function renderGraphviz(graphStr, opts) {
  const { format, engine, width, height } = opts || {};
  const viz = new Viz({ Module, render });
  const result = await viz.renderString(graphStr, {
    // Built-in format options don't work great. Hardcode to svg and convert it
    // to other supported formats later.
    format: 'svg',
    engine,
  });
  if (format === 'png') {
    const img = sharp(Buffer.from(result));
    if (width && height) {
      img.resize({
        width,
        height,
        fit: 'contain',
      });
    }
    return img.png().toBuffer();
  }
  return result;
}

module.exports = {
  renderGraphviz,
};
