const chartAnnotations = require('chartjs-plugin-annotation');
const chartDataLabels = require('chartjs-plugin-datalabels');
const chartRadialGauge = require('chartjs-chart-radial-gauge');
const winston = require('winston');
const { CanvasRenderService } = require('chartjs-node-canvas');
const { NodeVM } = require('vm2');

const logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({ timestamp: true, colorize: true }),
  ],
});

const DEFAULT_COLORS = {
  blue: 'rgba(54, 162, 235, 0.5)',
  orange: 'rgba(255, 159, 64, 0.5)',
  purple: 'rgba(153, 102, 255, 0.5)',
  red: 'rgba(255, 99, 132, 0.5)',
  yellow: 'rgba(255, 205, 86, 0.5)',
  green: 'rgba(75, 192, 192, 0.5)',
  grey: 'rgba(201, 203, 207, 0.5)',
};

const DEFAULT_COLOR_WHEEL = Object.values(DEFAULT_COLORS);

function addBackgroundColors(chart) {
  if (chart.data && chart.data.datasets && Array.isArray(chart.data.datasets)) {
    chart.data.datasets.forEach((dataset, dataIdx) => {
      const data = dataset;
      if (!data.backgroundColor) {
        if (chart.type === 'pie' || chart.type === 'doughnut') {
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

function renderChart(width, height, backgroundColor, untrustedChart) {
  let chart;
  try {
    if (untrustedChart.match(/(for|while)\(/gi)) {
      return Promise.reject(new Error('Input is not allowed'));
    }
    const vm = new NodeVM();
    chart = vm.run(`module.exports = ${untrustedChart}`);
  } catch (err) {
    logger.error('Input Error', err);
    return Promise.reject(new Error(`Invalid input\n${err}`));
  }

  chart.options = chart.options || {};

  if (chart.type === 'donut') {
    // Fix spelling...
    chart.type = 'doughnut';
  }

  if (chart.type === 'sparkline') {
    if (chart.data.datasets.length > 1) {
      return Promise.reject(new Error('"sparkline" only supports 1 line. Use "line" chart type for multiple lines.'));
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
    chart.options.elements.line = chart.options.elements.line || { borderColor: '#000', borderWidth: 1 };
    chart.options.elements.point = chart.options.elements.point || { radius: 0 };
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
    chart.options.scales.yAxes = chart.options.scales.yAxes || [{
      display: false,
      ticks: {
        min,
        max,
      },
    }];
  }

  // Implement default options
  chart.options.devicePixelRatio = 2.0;
  if (chart.type === 'bar' || chart.type === 'line' || chart.type === 'scatter' || chart.type === 'bubble') {
    if (!chart.options.scales) {
      // TODO(ian): Merge default options with provided options
      chart.options.scales = {
        yAxes: [{
          ticks: {
            beginAtZero: true,
          },
        }],
      };
    }
    addBackgroundColors(chart);
  } else if (chart.type === 'radar') {
    addBackgroundColors(chart);
  } else if (chart.type === 'pie' || chart.type === 'doughnut') {
    addBackgroundColors(chart);
  } else if (chart.type === 'scatter') {
    addBackgroundColors(chart);
  } else if (chart.type === 'bubble') {
    addBackgroundColors(chart);
  }

  if (chart.type === 'line') {
    chart.data.datasets.forEach((dataset) => {
      const data = dataset;
      // Make line charts straight lines by default.
      data.lineTension = data.lineTension || 0;
    });
  }

  chart.options.plugins = chart.options.plugins || {};
  if (!chart.options.plugins.datalabels) {
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

  logger.info('Chart:', JSON.stringify(chart));
  chart.plugins = [chartDataLabels, chartAnnotations];
  if (chart.type === 'radialGauge') {
    chart.plugins.push(chartRadialGauge);
  }

  chart.plugins.push({
    id: 'background',
    beforeDraw: (chartInstance) => {
      const { ctx } = chartInstance.chart;
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, chartInstance.chart.width, chartInstance.chart.height);
    },
  });

  const canvasRenderService = new CanvasRenderService(width, height);

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
