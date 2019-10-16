const mathjax = require('mathjax-node');
const svg2img = require('svg2img');

async function renderTex(input, format = 'svg') {
  let svgResult;
  try {
    const mathjaxResult = await mathjax.typeset({
      math: input,
      format: 'TeX',
      svg: true,
    });
    svgResult = mathjaxResult.svg;
  } catch (errString) {
    throw new Error(errString);
  }

  if (format === 'svg') {
    return svgResult;
  }

  return new Promise((resolve, reject) => {
    svg2img(svgResult, (err, buf) => {
      resolve(buf);
    });
  });
}

module.exports = {
  renderTex,
};
