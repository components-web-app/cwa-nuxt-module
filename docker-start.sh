#!/bin/sh
set -e

./playground/dev-ssl.sh

echo "$(dig +short host.docker.internal) caddy.local" >> /etc/hosts
npm install
npm run dev:prepare
npm run dev
