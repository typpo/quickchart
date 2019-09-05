#!/bin/bash -e

curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -

sudo apt-get update
sudo apt-get install -y libcairo2-dev libjpeg-dev libgif-dev libpango1.0-dev python nodejs yarn nginx monit

npm install -g pm2
