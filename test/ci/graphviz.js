/* eslint-env node, mocha */

const assert = require('assert');
const imageSize = require('image-size');

const { renderGraphviz } = require('../../lib/graphviz');

describe('graphviz rendering', () => {
  it('renders a basic graph svg', async () => {
    const graphStr =
      'digraph{C_0[shape=box];C_0->H_0[type=s];C_0->H_1[type=s];C_0->H_2[type=s];C_0->C_1[type=s];C_1->H_3[type=s];C_1->H_4[type=s];C_1->H_5[color=blue]}';
    const buf = await renderGraphviz(graphStr);
    assert(buf.length > 300);
    assert(buf.indexOf('C_1') > -1);
  });

  it('renders with a different engine', async () => {
    const graphStr =
      'digraph{C_0[shape=box];C_0->H_0[type=s];C_0->H_1[type=s];C_0->H_2[type=s];C_0->C_1[type=s];C_1->H_3[type=s];C_1->H_4[type=s];C_1->H_5[color=blue]}';
    const buf = await renderGraphviz(graphStr, {
      engine: 'neato',
    });
    assert(buf.length > 300);
    assert(
      buf.indexOf('202.0925,-67.4481 207.4376,-58.3004 197.5546,-62.1183 202.0925,-67.4481') > -1,
    );
  });

  it('handles a malformed graph', async () => {
    const graphStr = 'digraoobar}';
    assert.rejects(async () => {
      await renderGraphviz(graphStr);
    });
  });

  it('renders to png', async () => {
    const graphStr =
      'digraph{C_0[shape=box];C_0->H_0[type=s];C_0->H_1[type=s];C_0->H_2[type=s];C_0->C_1[type=s];C_1->H_3[type=s];C_1->H_4[type=s];C_1->H_5[color=blue]}';
    const buf = await renderGraphviz(graphStr, {
      format: 'png',
    });
    assert(buf.length > 3000);
  });

  it('renders to png with size', async () => {
    const graphStr =
      'digraph{C_0[shape=box];C_0->H_0[type=s];C_0->H_1[type=s];C_0->H_2[type=s];C_0->C_1[type=s];C_1->H_3[type=s];C_1->H_4[type=s];C_1->H_5[color=blue]}';
    const buf = await renderGraphviz(graphStr, {
      format: 'png',
      width: 800,
      height: 400,
    });
    const dimensions = imageSize(buf);
    assert.equal(800, dimensions.width);
    assert.equal(400, dimensions.height);
  });
});
