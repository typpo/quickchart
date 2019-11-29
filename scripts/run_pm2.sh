#!/bin/bash -e

pushd $(dirname $0) &>/dev/null

pm2 stop quickchart || true
pm2 delete quickchart || true
NODE_ENV=production ENABLE_TELEMETRY_WRITE=1 DISABLE_TELEMETRY=1 RATE_LIMIT_PER_MIN=120 pm2 start ../index.js --name 'quickchart' -i max --node-args="--max-http-header-size=65536"

popd &>/dev/null
