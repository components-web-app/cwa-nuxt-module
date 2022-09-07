#!/bin/sh
set -e

./demo/dev-ssl.sh

echo "$(dig +short host.docker.internal) api.cwa.local" >> /etc/hosts
yarn dev
