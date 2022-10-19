#!/bin/sh
set -e

./demo/dev-ssl.sh

echo "$(dig +short host.docker.internal) caddy.local" >> /etc/hosts
yarn install
yarn dev
