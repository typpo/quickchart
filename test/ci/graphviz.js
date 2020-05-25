/* eslint-env node, mocha */

const assert = require('assert');

const { renderGraphviz } = require('../../lib/graphviz');

describe('graphviz rendering', () => {
  it('renders a basic graph svg', async () => {
    const graphStr =
      'digraph{C_0[shape=box];C_0->H_0[type=s];C_0->H_1[type=s];C_0->H_2[type=s];C_0->C_1[type=s];C_1->H_3[type=s];C_1->H_4[type=s];C_1->H_5[color=blue]}';
    const buf = await renderGraphviz(graphStr, 'svg', 'dot');
    assert(buf.length > 300);
    assert(buf.indexOf('C_1') > -1);
  });

  it('handles a malformed graph', async () => {
    const graphStr = 'digraoobar}';
    assert.rejects(async () => {
      await renderGraphviz(graphStr, 'svg', 'dot');
    });
  });
});
