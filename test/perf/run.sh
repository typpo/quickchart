#!/bin/bash -e

pushd $(dirname $0) &>/dev/null

../../node_modules/artillery/bin/artillery run basic.yml

popd &>/dev/null

