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

const BASIC_CHART_V3 = {
  type: 'bar',
  data: {
    labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple', 'Orange'],
    datasets: [
      {
        label: '# of Votes',
        data: [12, 19, 3, 5, 2, 3],
        backgroundColor: [
          'rgba(255, 99, 132, 0.2)',
          'rgba(54, 162, 235, 0.2)',
          'rgba(255, 206, 86, 0.2)',
          'rgba(75, 192, 192, 0.2)',
          'rgba(153, 102, 255, 0.2)',
          'rgba(255, 159, 64, 0.2)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)',
        ],
        borderWidth: 1,
      },
    ],
  },
  options: {
    scales: {
      y: {
        beginAtZero: true,
      },
    },
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

const CHART_COLOR_SCHEME = {
  type: 'bar',
  data: {
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    datasets: [
      {
        label: 'Users',
        data: [50, 60, 70, 180],
      },
    ],
  },
  options: {
    plugins: {
      colorschemes: {
        scheme: 'office.Excel16',
      },
    },
  },
};

const CHART_GRADIENT_FILL = `{
  type: 'bar',
  data: {
    labels: [2012, 2013, 2014, 2015, 2016],
    datasets: [{
      label: 'abc',
      data: [12, 6, 5, 18, 12],
      backgroundColor: getGradientFillHelper('vertical', ["#36a2eb", "#a336eb", "#eb3639"]),
    }]
  }
}`;

const CHART_VIOLIN = {
  type: 'violin',
  data: {
    labels: [2012, 2013, 2014, 2015],
    datasets: [
      {
        label: 'Data',
        data: [
          [12, 6, 3, 4],
          [1, 8, 8, 15],
          [1, 1, 1, 2, 3, 5, 9, 8],
          [19, -3, 18, 8, 5, 9, 9],
        ],
        backgroundColor: 'rgba(56,123,45,0.2)',
        borderColor: 'rgba(56,123,45,1.9)',
      },
    ],
  },
};

const CHART_PROGRESSBAR = {
  type: 'progressBar',
  data: {
    datasets: [
      {
        data: [50],
      },
      {
        data: [100],
      },
    ],
  },
};

const DATETIME_V3 = {
  type: 'line',
  data: {
    labels: [
      new Date('2020-06-14T16:08:20.288Z'),
      new Date('2020-06-15T16:08:20.288Z'),
      new Date('2020-06-16T16:08:20.289Z'),
      new Date('2020-06-17T16:08:20.289Z'),
      new Date('2020-06-18T16:08:20.289Z'),
      new Date('2020-06-19T16:08:20.289Z'),
      new Date('2020-06-20T16:08:20.289Z'),
    ],
    datasets: [
      {
        label: 'My First dataset',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        borderColor: 'rgb(255, 99, 132)',
        fill: false,
        data: [38, -19, 35, -2, 77, 78, -93],
      },
      {
        label: 'My Second dataset',
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgb(54, 162, 235)',
        fill: false,
        data: [18, -7, 49, 86, 63, -92, -35],
      },
      {
        label: 'Dataset with point data',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        borderColor: 'rgb(75, 192, 192)',
        fill: false,
        data: [
          {
            x: '06/14/2020 09:08',
            y: -29,
          },
          {
            x: '06/19/2020 09:08',
            y: -34,
          },
          {
            x: '06/21/2020 09:08',
            y: -62,
          },
          {
            x: '06/29/2020 09:08',
            y: 1,
          },
        ],
      },
    ],
  },
  options: {
    locale: 'fr',
    title: {
      text: 'Chart.js Time Scale',
    },
    scales: {
      x: {
        type: 'time',
        time: {
          parser: 'MM/DD/YYYY HH:mm',
        },
        scaleLabel: {
          display: true,
          labelString: 'Date',
        },
      },
      y: {
        scaleLabel: {
          display: true,
          labelString: 'value',
        },
      },
    },
  },
};

module.exports = {
  BASIC_CHART,
  BASIC_CHART_V3,
  JS_CHART,
  CHART_COLOR_SCHEME,
  CHART_GRADIENT_FILL,
  CHART_VIOLIN,
  CHART_PROGRESSBAR,
  DATETIME_V3,
};
