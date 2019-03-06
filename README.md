QuickChart
---

QuickChart is a service that generates images of charts from a URL.  Because these charts are simple images, they are very easy to embed in non-dynamic environments such as email, SMS, chat rooms, and so on.

## See it in action

The chart image generation service is available online at [QuickChart.io](https://quickchart.io/).  There is an interactive editor that allows you to adjust inputs and build images.

Here's an example chart that is defined completely by its URL:

![Chart from URL](https://quickchart.io/chart?c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27January%27%2C%27February%27%2C%27March%27%2C%27April%27%2C%27May%27%5D%2Cdatasets%3A%5B%7Blabel%3A%27Dogs%27%2Cdata%3A%5B50%2C60%2C70%2C180%2C190%5D%7D%2C%7Blabel%3A%27Cats%27%2Cdata%3A%5B100%2C200%2C300%2C400%2C500%5D%7D%5D%7D%7D)

The above image can be included anywhere you like.  Here is its URL:

[https://quickchart.io/chart?width=500&height=300&c={type:'bar',data:{labels:['January','February','March','April','May'],datasets:[{label:'Dogs',data:[50,60,70,180,190]},{label:'Cats',data:[100,200,300,400,500]}]}}](https://quickchart.io/chart?width=500&height=300&c={type:'bar',data:{labels:['January','February','March','April','May'],datasets:[{label:'Dogs',data:[50,60,70,180,190]},{label:'Cats',data:[100,200,300,400,500]}]}})

As you can see, the JSON contained in the URL defines the chart:

```
{
  type: 'bar',
  data: {
    labels: ['January', 'February', 'March', 'April', 'May'],
    datasets: [{
      label: 'Dogs',
      data: [ 50, 60, 70, 180, 190 ]
    }, {
      label: 'Cats',
      data: [ 100, 200, 300, 400, 500 ]
    }]
  }
}
```

Chart configuration is compatible with the popular Chart.js API.  Check out the [Chart.js documentation](https://www.chartjs.org/docs/latest/charts/) for more information on how to customize your chart, or see [QuickChart.io](https://quickchart.io/) for more examples.

## Dependencies and Installation

Chart generation requires several system dependencies: Cairo, Pango, libjpeg, and libgif.  Run `./scripts/setup.sh` for a fresh install on Linux machines (note that this also installs yarn and node).  

To install system dependencies on Mac OSX, you probably just need to `brew install cairo`.

Once you have system dependencies installed, run `yarn install` or `npm install` to install the node dependencies.

## Running the server

`node index.js` will start the server on port 3400.

## License

QuickChart is open source, licensed under version 3 of the GNU GPL.  If you would like to use this project for commercial purposes, please [contact me](https://www.ianww.com/).
