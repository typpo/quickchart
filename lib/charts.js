const chartAnnotations = require('chartjs-plugin-annotation');
const chartDataLabels = require('chartjs-plugin-datalabels');
const chartRadialGauge = require('chartjs-chart-radial-gauge');
const { CanvasRenderService } = require('chartjs-node-canvas');
const { NodeVM } = require('vm2');

const { fixNodeVmObject } = require('./util');
const { logger } = require('../logging');

const LOOPS_REGEX = /(for|while)\s*\(/gi;
const ASYNC_REGEX = /\basync\b/gi;

const DEFAULT_COLORS = {
  blue: '#4D89F9',
  green: '#00B88A',
  orange: 'rgb(255, 159, 64)',
  red: 'rgb(255, 99, 132)',
  purple: 'rgb(153, 102, 255)',
  yellow: '#fc3',
  grey: 'rgb(201, 203, 207)',
};

const ROUND_CHART_TYPES = new Set([
  'pie',
  'doughnut',
  'polarArea',
  'outlabeledPie',
  'outlabeledDoughnut',
]);

const DEFAULT_COLOR_WHEEL = Object.values(DEFAULT_COLORS);

const rendererCache = {};

function getRenderer(width, height) {
  const key = [width, height];
  if (!rendererCache[key]) {
    rendererCache[key] = new CanvasRenderService(width, height);
  }
  return rendererCache[key];
}

function addBackgroundColors(chart) {
  if (chart.data && chart.data.datasets && Array.isArray(chart.data.datasets)) {
    chart.data.datasets.forEach((dataset, dataIdx) => {
      const data = dataset;
      if (!data.backgroundColor) {
        if (ROUND_CHART_TYPES.has(chart.type)) {
          // Return a color for each value.
          data.backgroundColor = data.data.map(
            (_, colorIdx) => DEFAULT_COLOR_WHEEL[colorIdx % DEFAULT_COLOR_WHEEL.length],
          );
        } else {
          // Return a color for each data.
          data.backgroundColor = DEFAULT_COLOR_WHEEL[dataIdx % DEFAULT_COLOR_WHEEL.length];
        }
      }
    });
  }
}

function renderChart(width, height, backgroundColor, devicePixelRatio, untrustedChart) {
  let chart;
  if (typeof untrustedChart === 'string') {
    // The chart could contain Javascript - run it in a VM.
    try {
      if (untrustedChart.match(LOOPS_REGEX) || untrustedChart.match(ASYNC_REGEX)) {
        return Promise.reject(new Error('Input is not allowed'));
      }
      const vm = new NodeVM({
        console: 'off',
        eval: false,
        wasm: false,
        sandbox: {
          Buffer: undefined,
          Array: undefined,
          Function: undefined,
          assert: undefined,
          console: undefined,
          Infinity: undefined,
          RegExp: undefined,
          Int8Array: undefined,
          Uint8Array: undefined,
          Uint8ClampedArray: undefined,
          Int16Array: undefined,
          Uint16Array: undefined,
          Int32Array: undefined,
          Uint32Array: undefined,
          Float32Array: undefined,
          Float64Array: undefined,
          BigInt64Array: undefined,
          BigUint64Array: undefined,
          Map: undefined,
          Set: undefined,
          WeakMap: undefined,
          WeakSet: undefined,
          ArrayBuffer: undefined,
          SharedArrayBuffer: undefined,
          Atomics: undefined,
          DataView: undefined,
          JSON: undefined,
          Promise: undefined,
          Generator: undefined,
          GeneratorFunction: undefined,
          AsyncFunction: undefined,
          Reflect: undefined,
          Proxy: undefined,
          Intl: undefined,
          WebAssembly: undefined,
          Object: undefined,
          Function: undefined,
          Boolean: undefined,
          Symbol: undefined,
          Error: undefined,
          AggregateError: undefined,
          EvalError: undefined,
          InternalError: undefined,
          RangeError: undefined,
          ReferenceError: undefined,
          SyntaxError: undefined,
          TypeError: undefined,
          URIError: undefined,
          setTimeout: undefined,
          setInterval: undefined,
          Promise: undefined,
          Proxy: undefined,
        },
      });
      chart = vm.run(`module.exports = ${untrustedChart}`);
    } catch (err) {
      logger.error('Input Error', err, untrustedChart);
      return Promise.reject(new Error(`Invalid input\n${err}`));
    }
  } else {
    // The chart is just a simple JSON object, nothing to be afraid of.
    chart = untrustedChart;
  }

  fixNodeVmObject(chart);

  chart.options = chart.options || {};

  if (chart.type === 'donut') {
    // Fix spelling...
    chart.type = 'doughnut';
  }

  if (chart.type === 'sparkline') {
    if (chart.data.datasets.length > 1) {
      return Promise.reject(
        new Error('"sparkline" only supports 1 line. Use "line" chart type for multiple lines.'),
      );
    }
    if (chart.data.datasets.length < 1) {
      return Promise.reject(new Error('"sparkline" requres 1 dataset'));
    }
    chart.type = 'line';
    const dataseries = chart.data.datasets[0].data;
    if (!chart.data.labels) {
      chart.data.labels = Array(dataseries.length);
    }
    chart.options.legend = chart.options.legend || { display: false };
    if (!chart.options.elements) {
      chart.options.elements = {};
    }
    chart.options.elements.line = chart.options.elements.line || {
      borderColor: '#000',
      borderWidth: 1,
    };
    chart.options.elements.point = chart.options.elements.point || {
      radius: 0,
    };
    if (!chart.options.scales) {
      chart.options.scales = {};
    }

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < dataseries.length; i += 1) {
      const dp = dataseries[i];
      min = Math.min(min, dp);
      max = Math.max(max, dp);
    }

    chart.options.scales.xAxes = chart.options.scales.xAxes || [{ display: false }];
    chart.options.scales.yAxes = chart.options.scales.yAxes || [
      {
        display: false,
        ticks: {
          // Offset the min and max slightly so that pixels aren't shaved off
          // under certain circumstances.
          min: min - min * 0.05,
          max: max + max * 0.05,
        },
      },
    ];
  }

  // Implement default options
  chart.options.devicePixelRatio = devicePixelRatio;
  if (
    chart.type === 'bar' ||
    chart.type === 'line' ||
    chart.type === 'scatter' ||
    chart.type === 'bubble'
  ) {
    if (!chart.options.scales) {
      // TODO(ian): Merge default options with provided options
      chart.options.scales = {
        yAxes: [
          {
            ticks: {
              beginAtZero: true,
            },
          },
        ],
      };
    }
    addBackgroundColors(chart);
  } else if (chart.type === 'radar') {
    addBackgroundColors(chart);
  } else if (ROUND_CHART_TYPES.has(chart.type)) {
    addBackgroundColors(chart);
  } else if (chart.type === 'scatter') {
    addBackgroundColors(chart);
  } else if (chart.type === 'bubble') {
    addBackgroundColors(chart);
  }

  if (chart.type === 'line') {
    chart.data.datasets.forEach(dataset => {
      const data = dataset;
      // Make line charts straight lines by default.
      data.lineTension = data.lineTension || 0;
    });
  }

  chart.options.plugins = chart.options.plugins || {};
  let usingDataLabelsDefaults = false;
  if (!chart.options.plugins.datalabels) {
    usingDataLabelsDefaults = true;
    chart.options.plugins.datalabels = {};
    if (chart.type === 'pie' || chart.type === 'doughnut') {
      chart.options.plugins.datalabels = {
        display: true,
      };
    } else {
      chart.options.plugins.datalabels = {
        display: false,
      };
    }
  }

  if (ROUND_CHART_TYPES.has(chart.type) || chart.type === 'radialGauge') {
    global.Chart = require('chart.js');
    // This require has side effects.
    require('chartjs-plugin-piechart-outlabels');
    let userSpecifiedOutlabels = false;
    chart.data.datasets.forEach(dataset => {
      if (dataset.outlabels || chart.options.plugins.outlabels) {
        userSpecifiedOutlabels = true;
      } else {
        // Disable outlabels by default.
        dataset.outlabels = { display: false };
      }
    });

    if (userSpecifiedOutlabels && usingDataLabelsDefaults) {
      // If outlabels are enabled, disable datalabels by default.
      chart.options.plugins.datalabels = {
        display: false,
      };
    }
  }
  logger.debug('Chart:', JSON.stringify(chart));

  chart.plugins = [chartDataLabels, chartAnnotations];
  if (chart.type === 'radialGauge') {
    chart.plugins.push(chartRadialGauge);
  }

  chart.plugins.push({
    id: 'background',
    beforeDraw: chartInstance => {
      const { ctx } = chartInstance.chart;
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, chartInstance.chart.width, chartInstance.chart.height);
    },
  });

  const canvasRenderService = getRenderer(width, height);

  try {
    return canvasRenderService.renderToBuffer(chart);
  } catch (err) {
    // canvasRenderService doesn't seem to be throwing errors correctly for
    // certain chart errors.
    return Promise.reject(err.message);
  }
}

module.exports = {
  DEFAULT_COLORS,
  DEFAULT_COLOR_WHEEL,
  renderChart,
};
