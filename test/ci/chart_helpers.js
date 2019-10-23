const javascriptStringify = require('javascript-stringify').stringify;

const BASIC_CHART = {
  type: 'bar',
  data: {
    labels: [2012, 2013, 2014, 2015, 2016],
    datasets: [
      {
        label: 'Bananas',
        data: [4, 8, 16, 5, 5],
      },
    ],
  },
};

const JS_CHART = javascriptStringify({
  type: 'bar',
  data: {
    labels: ['January', 'February', 'March', 'April', 'May'],
    datasets: [
      {
        label: 'Dogs',
        backgroundColor: 'chartreuse',
        data: [50, 60, 70, 180, 190],
      },
      {
        label: 'Cats',
        backgroundColor: 'gold',
        data: [100, 200, 300, 400, 500],
      },
    ],
  },
  options: {
    title: {
      display: true,
      text: 'Total Revenue',
      fontColor: 'hotpink',
      fontSize: 32,
    },
    legend: {
      position: 'bottom',
    },
    scales: {
      xAxes: [{ stacked: true }],
      yAxes: [
        {
          stacked: true,
          ticks: {
            callback: function(value) {
              return '$' + value;
            },
          },
        },
      ],
    },
    plugins: {
      datalabels: {
        display: true,
        font: {
          style: 'bold',
        },
      },
    },
  },
});

module.exports = {
  BASIC_CHART,
  JS_CHART,
};
