#!/bin/bash -e

docker stop quickchart || true
docker rm quickchart || true
docker run --name 'quickchart' -d --restart always -p 3400:3400 ianw/quickchart
