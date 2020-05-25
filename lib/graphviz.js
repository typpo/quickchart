const Viz = require('viz.js');
const { Module, render } = require('viz.js/full.render.js');

async function renderGraphviz(graphStr, format = 'svg', engine = 'dot') {
  const viz = new Viz({ Module, render });
  const result = await viz.renderString(graphStr, {
    format,
    engine,
  });
  return result;
}

module.exports = {
  renderGraphviz,
};
