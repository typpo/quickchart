const chartAnnotations = require('chartjs-plugin-annotation');
const chartBoxViolinPlot = require('chartjs-chart-box-and-violin-plot');
const chartDataLabels = require('chartjs-plugin-datalabels');
const chartRadialGauge = require('chartjs-chart-radial-gauge');
const pattern = require('patternomaly');
const { CanvasRenderService } = require('chartjs-node-canvas');
const { createCanvas } = require('canvas');
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

const BOXPLOT_CHART_TYPES = new Set(['boxplot', 'horizontalBoxplot', 'violin', 'horizontalViolin']);

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

function getGradientFunctions(width, height) {
  let temporaryCanvas = undefined;

  const getGradientFill = (colorOptions, linearGradient = [0, 0, width, 0]) => {
    if (!temporaryCanvas) {
      temporaryCanvas = createCanvas(20, 20);
    }
    const ctx = temporaryCanvas.getContext('2d');
    const gradientFill = ctx.createLinearGradient(...linearGradient);
    colorOptions.forEach((options, idx) => {
      gradientFill.addColorStop(options.offset, options.color);
    });
    return gradientFill;
  };

  const getGradientFillHelper = (direction, colors, dimensions = {}) => {
    const colorOptions = colors.map((color, idx) => {
      return {
        color,
        offset: idx / (colors.length - 1 || 1),
      };
    });

    let linearGradient = [0, 0, dimensions.width || width, 0];
    if (direction === 'vertical') {
      linearGradient = [0, 0, 0, dimensions.height || height];
    } else if (direction === 'both') {
      linearGradient = [0, 0, dimensions.width || width, dimensions.height || height];
    }
    return getGradientFill(colorOptions, linearGradient);
  };

  return {
    getGradientFill,
    getGradientFillHelper,
  };
}

function patternDraw(shapeType, backgroundColor, patternColor, requestedSize) {
  const size = Math.min(200, requestedSize) || 20;
  // patternomaly requires a document global...
  global.document = {
    createElement: () => {
      return createCanvas(size, size);
    },
  };
  return pattern.draw(shapeType, backgroundColor, patternColor, size);
}

function renderChart(width, height, backgroundColor, devicePixelRatio, untrustedChart) {
  let chart;
  if (typeof untrustedChart === 'string') {
    // The chart could contain Javascript - run it in a VM.
    try {
      if (untrustedChart.match(LOOPS_REGEX) || untrustedChart.match(ASYNC_REGEX)) {
        return Promise.reject(new Error('Input is not allowed'));
      }

      const { getGradientFill, getGradientFillHelper } = getGradientFunctions(width, height);
      const vm = new NodeVM({
        console: 'off',
        eval: false,
        wasm: false,
        sandbox: {
          getGradientFill,
          getGradientFillHelper,
          pattern: {
            draw: patternDraw,
          },

          AggregateError: undefined,
          Array: undefined,
          ArrayBuffer: undefined,
          AsyncFunction: undefined,
          Atomics: undefined,
          BigInt64Array: undefined,
          BigUint64Array: undefined,
          Boolean: undefined,
          Buffer: undefined,
          DataView: undefined,
          Error: undefined,
          EvalError: undefined,
          Float32Array: undefined,
          Float64Array: undefined,
          Function: undefined,
          Function: undefined,
          Generator: undefined,
          GeneratorFunction: undefined,
          Infinity: undefined,
          Int16Array: undefined,
          Int32Array: undefined,
          Int8Array: undefined,
          InternalError: undefined,
          Intl: undefined,
          JSON: undefined,
          Map: undefined,
          Object: undefined,
          Promise: undefined,
          Promise: undefined,
          Proxy: undefined,
          Proxy: undefined,
          RangeError: undefined,
          ReferenceError: undefined,
          Reflect: undefined,
          RegExp: undefined,
          Set: undefined,
          SharedArrayBuffer: undefined,
          Symbol: undefined,
          SyntaxError: undefined,
          TypeError: undefined,
          URIError: undefined,
          Uint16Array: undefined,
          Uint32Array: undefined,
          Uint8Array: undefined,
          Uint8ClampedArray: undefined,
          WeakMap: undefined,
          WeakSet: undefined,
          WebAssembly: undefined,
          assert: undefined,
          console: undefined,
          process: undefined,
          setInterval: undefined,
          setTimeout: undefined,
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
    // These requires have side effects.
    require('chartjs-plugin-piechart-outlabels');
    if (chart.type === 'doughnut') {
      require('chartjs-plugin-doughnutlabel');
    }
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
  if (BOXPLOT_CHART_TYPES.has(chart.type)) {
    chart.plugins.push(chartBoxViolinPlot);
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
