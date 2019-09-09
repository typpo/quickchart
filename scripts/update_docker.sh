#!/bin/bash -e

pushd $(dirname $0) &>/dev/null

cd ..

if [ $# -ne 1 ]; then
  echo 'Usage: ./update_docker.sh <version>'
  exit 1
fi

VERSION=$1

echo 'Updating latest...'

docker build -t ianw/quickchart .
docker push ianw/quickchart

echo "Updating version ${VERSION}"

docker build -t ianw/quickchart:${VERSION} .
docker push ianw/quickchart:${VERSION}

popd &>/dev/null

