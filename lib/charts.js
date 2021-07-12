const canvas = require('canvas');
const deepmerge = require('deepmerge');
const pattern = require('patternomaly');
const { CanvasRenderService } = require('chartjs-node-canvas');
const { NodeVM } = require('vm2');

const { fixNodeVmObject } = require('./util');
const { logger } = require('../logging');

// Polyfills
require('canvas-5-polyfill');
global.CanvasGradient = canvas.CanvasGradient;

// Constants
const ROUND_CHART_TYPES = new Set([
  'pie',
  'doughnut',
  'polarArea',
  'outlabeledPie',
  'outlabeledDoughnut',
]);

const BOXPLOT_CHART_TYPES = new Set(['boxplot', 'horizontalBoxplot', 'violin', 'horizontalViolin']);

const MAX_HEIGHT = process.env.CHART_MAX_HEIGHT || 3000;
const MAX_WIDTH = process.env.CHART_MAX_WIDTH || 3000;

const rendererCache = {};

function getRenderer(width, height, version) {
  if (width > MAX_WIDTH) {
    throw `Requested width exceeds maximum of ${MAX_WIDTH}`;
  }
  if (height > MAX_HEIGHT) {
    throw `Requested width exceeds maximum of ${MAX_WIDTH}`;
  }

  const key = `${width}__${height}__${version}`;
  if (!rendererCache[key]) {
    rendererCache[key] = new CanvasRenderService(width, height, undefined, undefined, () => {
      return version.startsWith('3') ? require('chart.js-v3') : require('chart.js');
    });
  }
  return rendererCache[key];
}

function addColorsPlugin(chart) {
  if (chart.options && chart.options.plugins && chart.options.plugins.colorschemes) {
    return;
  }

  chart.options = deepmerge.all([
    {},
    chart.options,
    {
      plugins: {
        colorschemes: {
          scheme: 'tableau.Tableau10',
        },
      },
    },
  ]);
}

function getGradientFunctions(width, height) {
  let temporaryCanvas = undefined;

  const getGradientFill = (colorOptions, linearGradient = [0, 0, width, 0]) => {
    if (!temporaryCanvas) {
      temporaryCanvas = canvas.createCanvas(20, 20);
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
      return canvas.createCanvas(size, size);
    },
  };
  return pattern.draw(shapeType, backgroundColor, patternColor, size);
}

function renderChartJs(width, height, backgroundColor, devicePixelRatio, version, untrustedChart) {
  let chart;
  if (typeof untrustedChart === 'string') {
    // The chart could contain Javascript - run it in a VM.
    try {
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
          Chart: version.startsWith('3') ? require('chart.js-v3') : require('chart.js'),
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

  // Patch some bugs and issues.
  fixNodeVmObject(chart);

  chart.options = chart.options || {};

  if (chart.type === 'donut') {
    // Fix spelling...
    chart.type = 'doughnut';
  }

  // TODO(ian): Move special chart type out of this file.
  if (chart.type === 'sparkline') {
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

  if (chart.type === 'progressBar') {
    chart.type = 'horizontalBar';

    if (chart.data.datasets.length < 1 || chart.data.datasets.length > 2) {
      throw new Error('progressBar chart requires 1 or 2 datasets');
    }

    let usePercentage = false;
    const dataLen = chart.data.datasets[0].data.length;
    if (chart.data.datasets.length === 1) {
      // Implicit denominator, always out of 100.
      usePercentage = true;
      chart.data.datasets.push({ data: Array(dataLen).fill(100) });
    }
    if (chart.data.datasets[0].data.length !== chart.data.datasets[1].data.length) {
      throw new Error('progressBar datasets must have the same size of data');
    }

    chart.data.labels = chart.labels || Array.from(Array(dataLen).keys());
    chart.data.datasets[1].backgroundColor = chart.data.datasets[1].backgroundColor || '#fff';
    // Set default border color to first Tableau color.
    chart.data.datasets[1].borderColor = chart.data.datasets[1].borderColor || '#4e78a7';
    chart.data.datasets[1].borderWidth = chart.data.datasets[1].borderWidth || 1;

    const deepmerge = require('deepmerge');
    chart.options = deepmerge(
      {
        legend: { display: false },
        scales: {
          xAxes: [
            {
              ticks: {
                display: false,
                beginAtZero: true,
              },
              gridLines: {
                display: false,
                drawTicks: false,
              },
            },
          ],
          yAxes: [
            {
              stacked: true,
              ticks: {
                display: false,
              },
              gridLines: {
                display: false,
                drawTicks: false,
                mirror: true,
              },
            },
          ],
        },
        plugins: {
          datalabels: {
            color: '#fff',
            formatter: (val, ctx) => {
              if (usePercentage) {
                return `${val}%`;
              }
              return val;
            },
            display: ctx => ctx.datasetIndex === 0,
          },
        },
      },
      chart.options,
    );
  }

  // Choose retina resolution by default. This will cause images to be 2x size
  // in absolute terms.
  chart.options.devicePixelRatio = devicePixelRatio || 2.0;

  // Implement other default options
  if (
    chart.type === 'bar' ||
    chart.type === 'horizontalBar' ||
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
    addColorsPlugin(chart);
  } else if (chart.type === 'radar') {
    addColorsPlugin(chart);
  } else if (ROUND_CHART_TYPES.has(chart.type)) {
    addColorsPlugin(chart);
  } else if (chart.type === 'scatter') {
    addColorsPlugin(chart);
  } else if (chart.type === 'bubble') {
    addColorsPlugin(chart);
  }

  if (chart.type === 'line') {
    if (chart.data && chart.data.datasets && Array.isArray(chart.data.datasets)) {
      chart.data.datasets.forEach(dataset => {
        const data = dataset;
        // Make line charts straight lines by default.
        data.lineTension = data.lineTension || 0;
      });
    }
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
    if (chart.type === 'doughnut' || chart.type === 'outlabeledDoughnut') {
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
  if (chart.options && chart.options.plugins && chart.options.plugins.colorschemes) {
    global.Chart = require('chart.js');
    require('chartjs-plugin-colorschemes');
  }
  logger.debug('Chart:', JSON.stringify(chart));

  if (version.startsWith('3')) {
    require('chartjs-adapter-moment');
  }
  if (!chart.plugins) {
    if (version.startsWith('3')) {
      chart.plugins = [];
    } else {
      const chartAnnotations = require('chartjs-plugin-annotation');
      const chartBoxViolinPlot = require('chartjs-chart-box-and-violin-plot');
      const chartDataLabels = require('chartjs-plugin-datalabels');
      const chartRadialGauge = require('chartjs-chart-radial-gauge');
      chart.plugins = [chartDataLabels, chartAnnotations];
      if (chart.type === 'radialGauge') {
        chart.plugins.push(chartRadialGauge);
      }
      if (BOXPLOT_CHART_TYPES.has(chart.type)) {
        chart.plugins.push(chartBoxViolinPlot);
      }
    }
  }

  // Background color plugin
  chart.plugins.push({
    id: 'background',
    beforeDraw: chartInstance => {
      if (backgroundColor) {
        // Chart.js v3 provides `chartInstance.chart` as `chartInstance`
        const chart = chartInstance.chart ? chartInstance.chart : chartInstance;
        const { ctx } = chart;
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, chart.width, chart.height);
      }
    },
  });

  // Pad below legend plugin
  if (chart.options.plugins.padBelowLegend) {
    chart.plugins.push({
      id: 'padBelowLegend',
      beforeInit: (chartInstance, val) => {
        global.Chart.Legend.prototype.afterFit = function() {
          this.height = this.height + (Number(val) || 0);
        };
      },
    });
  }

  const canvasRenderService = getRenderer(width, height, version);

  try {
    return canvasRenderService.renderToBuffer(chart);
  } catch (err) {
    // canvasRenderService doesn't seem to be throwing errors correctly for
    // certain chart errors.
    return Promise.reject(err.message || err);
  }
}

module.exports = {
  renderChartJs,
};
