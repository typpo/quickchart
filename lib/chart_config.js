class ChartConfigError extends Error {
  constructor(message) {
    super(`Invalid chart configuration: ${message}`);
    this.name = 'ChartConfigError';
  }
}

function isObject(value) {
  return value !== null && Object.prototype.toString.call(value) === '[object Object]';
}

function validateType(type, field) {
  if (type != null && (typeof type !== 'string' || !type.trim())) {
    throw new ChartConfigError(`${field} must be a non-empty string`);
  }
}

// Validate only the containers QuickChart and Chart.js need to mutate. Do not
// JSON-roundtrip configurations: callbacks, gradients, and plugin data are valid.
function validateChartConfig(chart) {
  if (!isObject(chart)) {
    throw new ChartConfigError('expected an object, not a string, array, or primitive');
  }
  validateType(chart.type, 'type');
  if (chart.data != null && !isObject(chart.data)) {
    throw new ChartConfigError('data must be an object');
  }
  if (chart.options != null && !isObject(chart.options)) {
    throw new ChartConfigError('options must be an object');
  }
  if (chart.plugins != null && !Array.isArray(chart.plugins)) {
    throw new ChartConfigError('plugins must be an array');
  }
  if (
    chart.options &&
    chart.options.plugins != null &&
    chart.options.plugins !== false &&
    !isObject(chart.options.plugins)
  ) {
    throw new ChartConfigError('options.plugins must be an object or false');
  }

  const data = chart.data || {};
  if (data.labels != null && !Array.isArray(data.labels)) {
    throw new ChartConfigError('data.labels must be an array');
  }
  if (data.datasets != null && !Array.isArray(data.datasets)) {
    throw new ChartConfigError('data.datasets must be an array');
  }
  const datasets = data.datasets || [];
  for (let i = 0; i < datasets.length; i += 1) {
    if (!isObject(datasets[i])) {
      throw new ChartConfigError(`data.datasets[${i}] must be an object`);
    }
    validateType(datasets[i].type, `data.datasets[${i}].type`);
    // These QuickChart shorthand types manipulate arrays before Chart.js runs.
    if (
      (chart.type === 'sparkline' || chart.type === 'progressBar') &&
      !Array.isArray(datasets[i].data)
    ) {
      throw new ChartConfigError(`data.datasets[${i}].data must be an array for ${chart.type}`);
    }
  }
}

function validateChartTypes(chart, Chart) {
  chart.data.datasets.forEach((dataset, index) => {
    const type = dataset.type || chart.config.type;
    // Chart.js 3/4 use a registry; v2 plugins extend Chart.controllers.
    const controllers = Chart.registry ? Chart.registry.controllers.items : Chart.controllers;
    if (!Object.prototype.hasOwnProperty.call(controllers, type)) {
      throw new ChartConfigError(
        `data.datasets[${index}] must use a registered chart type (set type on the chart or dataset)`,
      );
    }
  });
}

module.exports = { ChartConfigError, validateChartConfig, validateChartTypes };
