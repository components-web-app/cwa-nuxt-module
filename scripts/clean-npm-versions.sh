#!/bin/bash

set -xe

VERSIONS=$(pnpm view @cwa/nuxt-edge versions --json)

for id in $(echo "${VERSIONS}" | jq -r '.[]'); do
  pnpm unpublish "@cwa/nuxt-edge@${id}"
done
