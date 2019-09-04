#!/bin/bash -e

pushd $(dirname $0) &>/dev/null

cp ./quickchart_monit.cfg /etc/monit/conf.d/.
service monit restart

popd &>/dev/null
