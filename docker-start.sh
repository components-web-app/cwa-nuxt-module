#!/bin/sh
set -e

echo "$(dig +short host.docker.internal) api.cwa.local" >> /etc/hosts
yarn dev
