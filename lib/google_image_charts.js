// Google Image Charts compatibility

const DEFAULT_COLOR_WHEEL = ['#4D89F9', '#00B88A', 'red', 'purple', 'yellow', 'brown'];

const AXIS_FORMAT_REGEX_CHXS = /^\d(N([^\*]+)?(\*([fpe]+)?(c[A-Z]{3})?(\d)?([zsxy]+)?\*)?(.*))?$/;

function parseSize(chs) {
  if (!chs) {
    return {
      width: 500,
      height: 300,
    };
  }
  const size = chs.split('x');
  return {
    width: Math.min(2048, parseInt(size[0], 10)),
    height: Math.min(2048, parseInt(size[1], 10)),
  };
}

function parseBackgroundColor(chf) {
  if (!chf) {
    return 'white';
  }

  const series = chf.split('|');

  // For now we don't support any of the series coloring features - just look
  // at the first part.
  const parts = series[0].split(',');

  if (parts[0] === 'a') {
    // Transparency
    backgroundColor = '#000000' + parts[2].slice(-2);
  } else {
    // Fill
    backgroundColor = '#' + parts[2];
  }
  return backgroundColor;
}

/**
 * Returns a list of series objects. Each series object is a list of values.
 */
function parseSeriesData(chd, chds) {
  let seriesData;
  const [encodingType, seriesStr] = chd.split(':');
  switch (encodingType) {
    case 't':
      if (chds === 'a') {
        // Basic text format with auto scaling
        seriesData = seriesStr.split('|').map(valuesStr => {
          return valuesStr.split(',').map(val => {
            if (val === '_') {
              return null;
            }
            return parseFloat(val);
          });
        });
      } else {
        // Basic text format with set range
        const seriesValues = seriesStr.split('|');
        const seriesRanges = [];
        if (chds) {
          if (Array.isArray(chds)) {
            // We don't want to support Google weird scaling here per series...
            chds = chds[0];
          }
          const ranges = chds.split(',');
          for (let i = 0; i < ranges.length; i += 2) {
            const min = parseFloat(ranges[i]);
            const max = parseFloat(ranges[i + 1]);
            seriesRanges.push({ min, max });
          }

          if (seriesRanges.length < seriesValues.length) {
            // Fill out the remainder of ranges for all series, using the last
            // value.
            for (let i = 0; i <= seriesValues.length - seriesRanges.length; i++) {
              seriesRanges.push(seriesRanges[seriesRanges.length - 1]);
            }
          }
        } else {
          // Apply default minimums of 0 and maximums of 100.
          seriesValues.forEach(() => {
            seriesRanges.push({ min: 0, max: 100 });
          });
        }
        seriesData = seriesValues.map((valuesStr, idx) => {
          return valuesStr.split(',').map(val => {
            if (val === '_') {
              return null;
            }
            const floatVal = parseFloat(val);
            if (floatVal < seriesRanges[idx].min) {
              return null;
            }
            if (floatVal > seriesRanges[idx].max) {
              return seriesRanges[idx].max;
            }
            return floatVal;
          });
        });
      }
      break;
    case 's':
      // Simple encoding format
      const SIMPLE_LOOKUP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      seriesData = seriesStr.split(',').map(encoded => {
        const vals = [];
        for (let i = 0; i < encoded.length; i++) {
          const char = encoded.charAt(i);
          if (char === '_') {
            vals.push(null);
          } else {
            vals.push(SIMPLE_LOOKUP.indexOf(char));
          }
        }
        return vals;
      });
      break;
    case 'e':
      const EXTENDED_LOOKUP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-.';
      seriesData = seriesStr.split(',').map(encoded => {
        const vals = [];
        for (let i = 0; i < encoded.length; i += 2) {
          const word = encoded.slice(i, i + 2);
          if (word === '__') {
            vals.push(null);
          } else {
            const idx1 = EXTENDED_LOOKUP.indexOf(word[0]);
            const idx2 = EXTENDED_LOOKUP.indexOf(word[1]);

            const val = idx1 * EXTENDED_LOOKUP.length + idx2;
            vals.push(val);
          }
        }
        return vals;
      });
      break;
    case 'a':
      // Image Chart "awesome" format
      seriesData = seriesStr.split('|').map(valuesStr => {
        return valuesStr.split(',').map(parseFloat);
      });
      break;
  }
  return seriesData;
}

function setChartType(cht, chartObj) {
  let chartType;
  switch (cht) {
    case 'bhs':
      // Horizontal with stacked bars
      chartObj.type = 'horizontalBar';
      chartObj.options.scales = {
        xAxes: [
          {
            display: false,
            stacked: true,
            gridLines: { display: false },
          },
        ],
        yAxes: [
          {
            display: false,
            stacked: true,
            gridLines: { display: false },
            ticks: {
              beginAtZero: true,
            },
          },
        ],
      };
      break;
    case 'bvs':
      // Vertical with stacked bars
      chartObj.type = 'bar';
      chartObj.options.scales = {
        xAxes: [
          {
            display: false,
            stacked: true,
            gridLines: { display: false },
          },
        ],
        yAxes: [
          {
            display: false,
            stacked: true,
            gridLines: { display: false },
            ticks: {
              beginAtZero: true,
            },
          },
        ],
      };
      break;
    case 'bvo':
      // Vertical stacked in front of each other
      chartObj.type = 'bar';
      chartObj.options.scales = {
        xAxes: [
          {
            stacked: true,
            gridLines: { display: false },
          },
        ],
        yAxes: [
          {
            stacked: false,
            gridLines: { display: false },
            ticks: {
              beginAtZero: true,
            },
          },
        ],
      };
      break;
    case 'bhg':
      // Horizontal with grouped bars
      chartObj.type = 'horizontalBar';
      chartObj.options.scales = {
        xAxes: [
          {
            display: false,
            gridLines: { display: false },
          },
        ],
        yAxes: [
          {
            display: false,
            gridLines: { display: false },
            ticks: {
              beginAtZero: true,
            },
          },
        ],
      };
      break;
    case 'bvg':
      // Vertical with grouped bars
      chartObj.type = 'bar';
      chartObj.options.scales = {
        xAxes: [
          {
            display: false,
            gridLines: { display: false },
          },
        ],
        yAxes: [
          {
            display: false,
            gridLines: { display: false },
            ticks: {
              beginAtZero: true,
            },
          },
        ],
      };
      break;
    case 'lc':
      // TODO(ian): Support 'nda': no default axes to suppress axes
      // https://chart.googleapis.com/chart?cht=lc:nda&chs=200x125&chd=t:40,60,60,45,47,75,70,72
      chartObj.type = 'line';
      chartObj.options.scales = {
        xAxes: [
          {
            display: false,
            gridLines: {
              drawOnChartArea: false,
              drawTicks: false,
            },
          },
        ],
        yAxes: [
          {
            display: false,
            gridLines: {
              drawOnChartArea: false,
              drawTicks: false,
            },
            ticks: {
              beginAtZero: true,
            },
          },
        ],
      };
      break;
    case 'ls':
      // Sparkline
      chartObj.type = 'line';
      chartObj.options.scales = {
        xAxes: [
          {
            display: false,
            gridLines: { display: false },
          },
        ],
        yAxes: [
          {
            display: false,
            gridLines: { display: false },
            ticks: {
              beginAtZero: true,
            },
          },
        ],
      };
      break;
    case 'p':
    case 'p3':
    case 'pc':
      chartObj.type = 'pie';
      chartObj.options.plugins = {
        datalabels: {
          display: false,
        },
      };
      break;
    case 'lxy':
      // TODO(ian): x-y coordinates/scatter chart
      // https://developers.google.com/chart/image/docs/gallery/scatter_charts
      break;
  }
}

function setData(seriesData, chartObj) {
  const lengths = seriesData.map(series => series.length);
  const longestSeriesLength = Math.max(...lengths);

  // TODO(ian): For horizontal stacked bar charts, indexes are shown top down
  // instead of bottom up.
  chartObj.data.labels = Array(longestSeriesLength)
    .fill(0)
    .map((_, idx) => idx);

  // Round chart types (e.g. pie) have different color handling.
  const isRound = chartObj.type === 'pie';

  chartObj.data.datasets = seriesData.map((series, idx) => {
    return {
      data: series,
      fill: false,
      backgroundColor: isRound ? undefined : DEFAULT_COLOR_WHEEL[idx % DEFAULT_COLOR_WHEEL.length],
      borderColor: isRound ? undefined : DEFAULT_COLOR_WHEEL[idx % DEFAULT_COLOR_WHEEL.length],
      borderWidth: 2,
      pointRadius: 0,
    };
  });

  if (chartObj.type === 'pie') {
    chartObj.data.datasets = chartObj.data.datasets.reverse();
  }
}

function setTitle(chtt, chts, chartObj) {
  if (!chtt) {
    return;
  }

  let fontColor, fontSize;
  if (chts) {
    const splits = chts.split(',');
    fontColor = `#${splits[0]}`;
    fontSize = parseInt(splits[1], 10);
  }
  chartObj.options.title = {
    display: true,
    text: chtt.replace('|', '\n', 'g'),
    fontSize,
    fontColor,
  };
}

function setDataLabels(chl, chartObj) {
  if (!chl) {
    return;
  }

  const labels = chl.split('|');

  // TODO(ian): line charts are supposed to have an effect similar to axis
  // value formatters, rather than data labels.
  chartObj.options.plugins = chartObj.options.plugins || {};
  chartObj.options.plugins.datalabels = {
    display: true,
    color: '#000',
    font: {
      size: 14,
    },
    formatter: (val, ctx) => {
      let labelIdx = 0;
      for (let datasetIndex = 0; datasetIndex < ctx.datasetIndex; datasetIndex++) {
        // Skip over the labels for all the previous datasets.
        labelIdx += chartObj.data.datasets[datasetIndex].data.length;
      }

      // Skip over the labels for data in the current dataset.
      labelIdx += ctx.dataIndex;

      if (!labels[labelIdx]) {
        return '';
      }
      return labels[labelIdx].replace('\\n', '\n');
    },
  };
}

function setLegend(chdl, chdlp, chdls, chartObj) {
  if (!chdl) {
    chartObj.options.legend = {
      display: false,
    };
    return;
  }
  chartObj.options.legend = {
    display: true,
  };
  const labels = chdl.split('|');
  labels.forEach((label, idx) => {
    // Note that this overrides 'chl' labels right now
    chartObj.data.datasets[idx].label = label;
  });

  switch (chdlp || 'r') {
    case 'b':
      chartObj.options.legend.position = 'bottom';
      break;
    case 't':
      chartObj.options.legend.position = 'top';
      break;
    case 'r':
      chartObj.options.legend.position = 'right';
      chartObj.options.legend.align = 'start';
      break;
    case 'l':
      chartObj.options.legend.position = 'left';
      chartObj.options.legend.align = 'start';
      break;
    default:
    // chdlp is not fully supported
  }

  // Make legend labels smaller.
  chartObj.options.legend.labels = {
    boxWidth: 10,
  };

  if (chdls) {
    const [fontColor, fontSize] = chdls.split(',');
    chartObj.options.legend.fontSize = parseInt(fontSize, 10);
    chartObj.options.legend.fontColor = `#${fontColor}`;
  }
}

function setMargins(chma, chartObj) {
  const margins = {
    left: 0,
    right: 0,
    top: 10,
    bottom: 0,
  };

  if (chma) {
    const inputs = chma.split(',').map(x => parseInt(x, 10));
    margins.left = inputs[0];
    margins.right = inputs[1];
    margins.top = inputs[2];
    margins.bottom = inputs[3];
  }

  chartObj.options.layout = chartObj.options.layout || {};
  chartObj.options.layout.padding = margins;
}

function setColors(chco, chartObj) {
  if (!chco) {
    return null;
  }

  let seriesColors = chco.split(',').map(colors => {
    if (colors.indexOf('|') > -1) {
      return colors.split('|').map(color => `#${color}`);
    }
    return colors;
  });

  chartObj.data.datasets.forEach((dataset, idx) => {
    if (Array.isArray(seriesColors[idx])) {
      // Colors behave differently for Chart.js pie chart and bar charts.
      dataset.backgroundColor = dataset.borderColor = seriesColors[idx];
    } else {
      dataset.backgroundColor = dataset.borderColor = '#' + seriesColors[idx];
    }
  });
}

function setAxes(chxt, chxr, chartObj) {
  if (!chxt) {
    return;
  }

  const enabledAxes = chxt.split(',');

  if (chxr) {
    // Custom axes range
    const axesSettings = chxr.split('|');
    axesSettings.forEach(axisSetting => {
      const opts = axisSetting.split(',').map(parseFloat);

      const axisName = enabledAxes[opts[0] /* axisIndex */];
      const minVal = opts[1];
      const maxVal = opts[2];
      const stepVal = opts.length > 3 ? opts[3] : undefined;

      let axis;
      if (axisName === 'x') {
        // Manually scale X-axis so  data values extend the full range:
        // chart.js doesn't respect min/max in categorical axes.
        axis = chartObj.options.scales.xAxes[0];
        axis.type = 'linear';
        chartObj.data.datasets.forEach(dataset => {
          const step = (maxVal - minVal) / dataset.data.length;
          let currentStep = minVal;
          dataset.data = dataset.data.map(dp => {
            const ret = {
              x: currentStep,
              y: dp,
            };
            currentStep += step;
            return ret;
          });
        });
      } else if (axisName === 'y') {
        axis = chartObj.options.scales.yAxes[0];
      }
      axis.ticks = axis.ticks || {};
      axis.ticks.min = minVal;
      axis.ticks.max = maxVal;
      axis.ticks.stepSize = stepVal;
      axis.ticks.maxTicksLimit = Number.MAX_VALUE;
    });
  }
}

function setAxesLabels(chxt, chxl, chxs, chartObj) {
  if (!chxt) {
    return;
  }

  // e.g. {
  //  0: 'x',
  //  1: 'y',
  // }
  const axisByIndex = {};

  // e.g. {
  //   'x': ['Jan', 'Feb', 'March'],
  //   'y': ['0', '1', '2'],
  // }
  const axisLabelsLookup = {
    x: [],
    y: [],
  };

  // e.g. {
  //   'x': Array<Function>,
  //   'y': Array<Function>,
  // }
  const axisValFormatters = {
    x: [],
    y: [],
  };

  // Parse chxt
  const validAxesLabels = new Set();
  const axes = chxt.split(',');
  axes.forEach((axis, idx) => {
    axisByIndex[idx] = axis;
    validAxesLabels.add(`${idx}:`);
  });

  if (axes.indexOf('x') > -1) {
    chartObj.options.scales.xAxes[0].display = true;

    if (chartObj.type === 'horizontalBar') {
      // Horizontal bar charts have x axis ticks.
      chartObj.options.scales.xAxes[0].gridLines = chartObj.options.scales.xAxes[0].gridLines || {};
      chartObj.options.scales.xAxes[0].gridLines.display =
        chartObj.options.scales.xAxes[0].gridLines.display ?? true;
      chartObj.options.scales.xAxes[0].gridLines.drawOnChartArea =
        chartObj.options.scales.xAxes[0].gridLines.drawOnChartArea ?? false;
      chartObj.options.scales.xAxes[0].gridLines.drawTicks =
        chartObj.options.scales.xAxes[0].gridLines.drawTicks ?? true;
    }

    chartObj.options.scales.xAxes[0].ticks = chartObj.options.scales.xAxes[0].ticks || {};
    chartObj.options.scales.xAxes[0].ticks.autoSkip =
      chartObj.options.scales.xAxes[0].ticks.autoSkip ?? false;
  }
  if (axes.indexOf('y') > -1) {
    chartObj.options.scales.yAxes[0].display = true;

    // Google Image Charts show yAxes ticks.
    chartObj.options.scales.yAxes[0].gridLines = chartObj.options.scales.yAxes[0].gridLines || {};
    chartObj.options.scales.yAxes[0].gridLines.display =
      chartObj.options.scales.yAxes[0].gridLines.display ?? true;
    chartObj.options.scales.yAxes[0].gridLines.drawOnChartArea =
      chartObj.options.scales.yAxes[0].gridLines.drawOnChartArea ?? false;
    chartObj.options.scales.yAxes[0].gridLines.offsetGridLines =
      chartObj.options.scales.yAxes[0].gridLines.offsetGridLines ?? false;
    chartObj.options.scales.yAxes[0].gridLines.drawTicks =
      chartObj.options.scales.yAxes[0].gridLines.drawTicks ?? true;
  }

  if (chxs) {
    // TODO(ian): If chxs doesn't have N in front of it, then skip forward to
    // color and labels.
    // https://developers.google.com/chart/image/docs/gallery/bar_charts#axis-label-styles-chxs
    // chxs=0,000000,0,0,_
    const axisRules = chxs.split('|');
    axisRules.forEach(rule => {
      const parts = rule.split(',');

      // Parse the first character of the first part as axis index.
      const axisIdx = parseInt(parts[0][0], 10);
      const axisName = axisByIndex[axisIdx];
      const axis =
        axisName === 'x' ? chartObj.options.scales.xAxes[0] : chartObj.options.scales.yAxes[0];

      const hexColor = parts[1];
      const fontSize = parts[2];
      const alignment = parts[3];
      const axisTickVisibility = parts[4];
      const tickColor = parts[5];
      const axisColor = parts[6];
      const skipLabels = parts[7];

      axis.gridLines = axis.gridLines || {};
      switch (axisTickVisibility) {
        case 'l':
          // Axis line only
          axis.display = true;
          axis.gridLines.drawTicks = false;
          break;
        case 't':
          // Tick marks only
          axis.display = true;
          axis.gridLines.drawTicks = true;
          break;
        case '_':
          // Neither axis nor tick marks
          axis.display = false;
          break;
        case 'lt':
        default:
          // Ticks and axis line
          axis.display = true;
          axis.gridLines.drawTicks = true;
          break;
      }

      const matchResults = AXIS_FORMAT_REGEX_CHXS.exec(parts[0]);
      if (matchResults && matchResults[1]) {
        // Apply prefix and suffix.
        let tickPrefix = matchResults[2] || '';
        let tickSuffix = matchResults[8] || '';

        // Apply cryptic formatting rules.
        const valueType = matchResults[4];
        const currency = matchResults[5];
        const numDecimalPlaces = matchResults[6] ? parseInt(matchResults[6], 10) : 2;
        const otherOptions = matchResults[7];

        if (valueType && valueType.indexOf('p') > -1) {
          // Display a percentage: add % sign and multiply by 100.
          tickSuffix += '%';
          axisValFormatters[axisName].push(val => {
            return val * 100.0;
          });
        } else if (valueType && valueType.indexOf('e') > -1) {
          // Exponential: scientific notation
          axisValFormatters[axisName].push(val => {
            return val.toExponential();
          });
        } else if (currency) {
          const CURRENCY_SYMBOLS = {
            AUD: '$',
            CAD: '$',
            CHF: 'CHF',
            CNY: '元',
            EUR: '€',
            GBP: '£',
            HKD: '$',
            INR: '₹',
            JPY: '¥',
            KRW: '₩',
            MXN: '$',
            NOK: 'kr',
            NZD: '$',
            RUB: '₽',
            SEK: 'kr',
            TRY: '₺',
            USD: '$',
            ZAR: 'R',
          };
          const symbol = CURRENCY_SYMBOLS[currency.slice(1)] || '$';
          tickPrefix += symbol;
        }

        if (otherOptions && otherOptions.indexOf('s')) {
          // Add thousands separator and apply number of decimal places
          axisValFormatters[axisName].push(val => {
            return val.toLocaleString('en', {
              minimumFractionDigits: numDecimalPlaces,
            });
          });
        } else {
          // Apply number of decimal places
          axisValFormatters[axisName].push(val => {
            return val.toFixed(numDecimalPlaces);
          });
        }

        axisValFormatters[axisName].push(val => {
          return tickPrefix + val + tickSuffix;
        });

        // TODO(ian): Support trailing zeroes option 'z'

        // Apply formatters!
        axis.ticks = axis.ticks || {};

        let nextLabelIdx = 0;
        axis.ticks.callback = (val, tickIdx, vals) => {
          let retVal = val;
          axisValFormatters[axisName].forEach(formatFn => {
            retVal = formatFn(retVal);
          });
          return retVal;
        };
      }
    });
  }

  if (chxl) {
    const splits = chxl.split('|');
    let currentAxisIdx, currentAxisName;
    splits.forEach(label => {
      if (validAxesLabels.has(label)) {
        currentAxisIdx = parseInt(label.replace(':', ''), 10);
        currentAxisName = axisByIndex[currentAxisIdx];
        // Placeholder lists already created, below line unnecessary.
        // axisLabelsLookup[currentAxisName] = axisLabelsLookup[currentAxisName] || [];
      } else {
        axisLabelsLookup[currentAxisName].push(label);
      }
    });

    // These axis ticks override the above automatic formatting axis ticks.
    setAxisTicks('x', axisLabelsLookup, chartObj);
    setAxisTicks('y', axisLabelsLookup, chartObj);
  }
}

function setAxisTicks(axisName, axisLabelsLookup, chartObj) {
  let axisLabels = axisLabelsLookup[axisName];
  if (axisLabels && axisLabels.length > 0) {
    if (axisName === 'y') {
      axisLabels = axisLabels.reverse();
    }
    const axis =
      axisName === 'x' ? chartObj.options.scales.xAxes[0] : chartObj.options.scales.yAxes[0];
    axis.ticks = axis.ticks || {};

    let nextLabelIdx = 0;
    axis.ticks.callback = (val, tickIdx, vals) => {
      // This needs to be rebuilt every time in callback, because this is the
      // only place we have access to accurate 'vals' (which varies based on
      // axis scale etc).

      // TODO(ian): Need an odd number of ticks for an odd number of axis
      // labels. Otherwise they won't quite be spaced evenly.
      const numTicks = vals.length;
      const numLabels = axisLabels.length;

      const idxToLabel = {};
      const stepSize = numTicks / (numLabels - 1);
      for (let i = 0; i < numLabels - 1; i++) {
        const label = axisLabels[i];
        idxToLabel[Math.floor(stepSize * i)] = label;
      }
      idxToLabel[numTicks - 1] = axisLabels[numLabels - 1];

      return idxToLabel[tickIdx] || '';
    };
    axis.ticks.minRotation = 0;
    axis.ticks.maxRotation = 0;
    axis.ticks.padding = 2;
  }
}

function setMarkers(chm, chartObj) {
  if (!chm) {
    return;
  }

  const enabledSeriesIndexes = new Set();
  let hideMarkers = false;
  chm.split('|').forEach((markerRule, idx) => {
    const parts = markerRule.split(',');
    const markerType = parts[0];
    const markerColor = parts[1];

    if (markerType === 'B' || markerType === 'b') {
      chartObj.data.datasets[idx].fill = true;
      chartObj.data.datasets[idx].backgroundColor = '#' + markerColor;
    }

    // TODO(ian): All of the marker options. See
    // https://developers.google.com/chart/image/docs/chart_params#gcharts_data_point_labels
    const seriesIndex = parts[2];
    const size = parts[4];
    if (parseInt(size, 10) === 0) {
      hideMarkers = true;
    }

    enabledSeriesIndexes.add(parseInt(seriesIndex, 10));

    // chm=N,000000,0,,10|N,000000,1,,10|N,000000,2,,10
  });

  chartObj.options.plugins = {
    datalabels: {
      display: !hideMarkers,
      anchor: 'end',
      align: 'end',
      offset: 0,
      font: {
        size: 10,
        weight: 'bold',
      },
      formatter: (value, context) => {
        if (enabledSeriesIndexes.has(context.datasetIndex)) {
          return value;
        }
        return null;
      },
    },
  };
}

function setGridLines(chg, chartObj) {
  if (!chg) {
    return;
  }

  const parts = chg.split(',');

  if (Number(parts[0]) > 0) {
    chartObj.options.scales.xAxes[0].gridLines.display = true;
    chartObj.options.scales.xAxes[0].gridLines.drawOnChartArea = true;
  }
  if (Number(parts[1]) > 0) {
    chartObj.options.scales.yAxes[0].gridLines.display = true;
    chartObj.options.scales.yAxes[0].gridLines.drawOnChartArea = true;
  }

  if (parts.length >= 2) {
    const numGridLinesX = 100 / parseInt(parts[0], 10);
    const numGridLinesY = 100 / parseInt(parts[1], 10);

    chartObj.options.scales.xAxes[0].ticks = {
      maxTicksLimit: numGridLinesX,
    };
    chartObj.options.scales.yAxes[0].ticks = {
      maxTicksLimit: numGridLinesY,
    };
  }

  // TODO(ian): dash sizes etc
  // https://developers.google.com/chart/image/docs/gallery/line_charts

  // TODO(ian): Full implementation https://developers.google.com/chart/image/docs/chart_params#gcharts_grid_lines
}

function setLineChartOptions(chl, chartObj) {
  // Set options specific to line chart.
  if (!chl) {
    return;
  }

  const series = chl.split('|');
  series.forEach((serie, idx) => {
    const parts = serie.split(',');
    const thickness = parseInt(parts[0], 10);
    // TODO(ian): Support for dashed line
    // dashLength = parts[1]
    // spaceLength = parts[2]

    if (!isNaN(thickness)) {
      chartObj.data.datasets[idx].borderWidth = thickness;
    }
  });
}

function toChartJs(query) {
  //renderChart(width, height, backgroundColor, devicePixelRatio, untrustedChart) {
  const { width, height } = parseSize(query.chs);

  const backgroundColor = parseBackgroundColor(query.chf);

  // Parse data
  const seriesData = parseSeriesData(query.chd, query.chds);

  // Start building the chart
  const chartObj = {
    data: {},
    options: {},
  };

  setChartType(query.cht, chartObj);
  setData(seriesData, chartObj);
  setTitle(query.chtt, query.chts, chartObj);
  setGridLines(query.chg, chartObj);
  setLegend(query.chdl, query.chdlp, query.chdls, chartObj);
  setMargins(query.chma, chartObj);

  setDataLabels(query.chl, chartObj);
  setColors(query.chco, chartObj);
  setAxes(query.chxt, query.chxr, chartObj);
  setAxesLabels(query.chxt, query.chxl, query.chxs, chartObj);

  setMarkers(query.chm, chartObj);
  setGridLines(query.chg, chartObj);

  setLineChartOptions(query.chls, chartObj);

  // TODO(ian): Bar Width and Spacing chbh
  // Zero Line chp

  // console.log(JSON.stringify(chartObj, null, 2));

  return {
    width,
    height,
    backgroundColor,
    chart: chartObj,
  };
}

module.exports = {
  toChartJs,
  parseSeriesData,
  parseSize,
};
