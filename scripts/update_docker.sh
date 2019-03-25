#!/bin/bash -e

docker build -t ianw/quickchart .
docker push ianw/quickchart

