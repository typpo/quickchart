#!/bin/bash -e

pushd $(dirname $0) &>/dev/null

cd ..

docker build -t ianw/quickchart .
docker push ianw/quickchart

popd &>/dev/null

