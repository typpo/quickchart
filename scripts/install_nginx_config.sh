#!/bin/bash -e

pushd $(dirname $0) &>/dev/null

cd ..
sudo cp nginx/conf.d/local.conf /etc/nginx/conf.d/.
sudo service nginx reload

popd &>/dev/null
