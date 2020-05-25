/* eslint-env node, mocha */

const assert = require('assert');

const { parseSeriesData } = require('../../lib/google_image_charts');

describe('google image charts', () => {
  it('parses text encoding', async () => {
    const result = parseSeriesData('t:_,30,-30,50,80,200');
    assert.deepEqual([[null, 30, null, 50, 80, 100]], result);
  });

  it('parses text encoding with auto scaling', async () => {
    const result = parseSeriesData('t:_,30,-30,50,80,200', 'a');
    assert.deepEqual([[null, 30, -30, 50, 80, 200]], result);
  });

  it('parses text encoding with custom scaling', async () => {
    // Google-provided example
    const result = parseSeriesData('t:30,-60,50,140,80,-90', '-80,140');
    assert.deepEqual([[30, -60, 50, 140, 80, null]], result);
  });

  it('parses text encoding with custom scaling', async () => {
    const result = parseSeriesData('t:30,-50,141,80,-90|-30,-70,-200,100,0', '-80,140,-150,0');
    assert.deepEqual(
      [
        [30, -50, 140, 80, null],
        [-30, -70, null, 0, 0],
      ],
      result,
    );
  });

  it('parses simple encoding', async () => {
    const result = parseSeriesData('s:BTb19_,Mn5tzb');
    assert.deepEqual(
      [
        [1, 19, 27, 53, 61, null],
        [12, 39, 57, 45, 51, 27],
      ],
      result,
    );
  });

  it('parses extended encoding', async () => {
    const result = parseSeriesData('e:BaPoqM2s,-A__RMD6');
    assert.deepEqual(
      [
        [90, 1000, 2700, 3500],
        [3968, null, 1100, 250],
      ],
      result,
    );
  });

  it('parses shorthand auto encoding', async () => {
    assert.deepEqual([[1, 2, 3]], parseSeriesData('a:1,2,3'));
    assert.deepEqual(
      [
        [4, 5, 6],
        [1, 2, 3],
      ],
      parseSeriesData('a:4,5,6|1,2,3'),
    );
  });
});
