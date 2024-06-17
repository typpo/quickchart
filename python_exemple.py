import base64
from io import BytesIO
from random import randint

import requests
from PIL import Image

from quickchart import QuickChart, QuickChartFunction

qc = QuickChart()
qc.host = "ENTER HOST HERE"
qc.version = "3"


def imageURLtoBase64(url):
    r = requests.get(url)
    image = Image.open(BytesIO(r.content))
    buffered = BytesIO()
    image.save(buffered, format=image.format)
    img_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
    return f"data:image/{image.format.lower()};base64,{img_base64}"


labels = ["Red Vans", "Blue Vans", "Green Vans", "Gray Vans"]
images = [
    "https://i.sstatic.net/2RAv2.png",
    "https://i.sstatic.net/Tq5DA.png",
    "https://i.sstatic.net/3KRtW.png",
    "https://i.sstatic.net/iLyVi.png",
]
# chart.js can't load image urls, so we need to convert them to base64
images = [imageURLtoBase64(url) for url in images]
values = [randint(1, 50) for _ in range(len(labels))]

qc.config = {
    "type": "bar",
    "plugins": [
        {
            "id": "custom-labels",
            "afterDraw": QuickChartFunction(
                f"""
            (chart, args, options) => {{
                const {{ctx}} = chart;
                //console.log(chart.scales);
                var xAxis = chart.scales['xAxes'];
                var yAxis = chart.scales['yAxes'];
                var images = {images};
                xAxis.ticks.forEach((value, index) => {{
                    var x = xAxis.getPixelForTick(index);
                    var img = new Image();
                    img.onload = function() {{ ctx.drawImage(img, x - 12, yAxis.bottom + 10, 24, 24); }};
                    img.src = images[index];
                }});
            }}
            """
            ),
        }
    ],
    "data": {
        "labels": labels,
        "datasets": [
            {
                "label": "My Dataset",
                "data": values,
                "backgroundColor": ["red", "blue", "green", "lightgray"],
            }
        ],
    },
    "options": {
        "plugins": {"legend": {"display": False}},
        "scales": {
            "yAxes": {"beginAtZero": True},
            "xAxes": {"ticks": {"padding": 30}},
        },
    },
}

qc.to_file("/tmp/chart.png")
# print(qc.get_url())
