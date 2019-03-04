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
    chart.data.datasets.forEach((dataset, idx) => {
      if (!dataset.backgroundColor) {
        if (chart.type === 'pie' || chart.type === 'doughnut') {
          dataset.backgroundColor = dataset.data.map((_, idx) => {
            // Return a color for each value.
            return DEFAULT_COLOR_WHEEL[idx % DEFAULT_COLOR_WHEEL.length];
          });
        } else {
          // Return a color for each dataset.
          dataset.backgroundColor = DEFAULT_COLOR_WHEEL[idx % DEFAULT_COLOR_WHEEL.length];
        }
      }
    });
  }
}

module.exports = {
  DEFAULT_COLORS,
  DEFAULT_COLOR_WHEEL,
  addBackgroundColors,
};
