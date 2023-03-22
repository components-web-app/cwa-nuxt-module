#!/bin/sh
set -e

./playground/dev-ssl.sh

echo "$(dig +short host.docker.internal) caddy.local" >> /etc/hosts
cd ./playground
npm install
cd ../
npm install
npm run dev:prepare
npm run dev
