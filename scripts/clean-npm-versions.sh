#!/bin/bash

VERSIONS=$(pnpm view @cwa/nuxt-edge versions --json)

for id in $(echo "${VERSIONS}" | jq -r '.[]'); do
  echo "Unpublishing @cwa/nuxt-edge@${id}"
  read -p "Please enter the otp for NPM: " otp
  pnpm unpublish "@cwa/nuxt-edge@${id}" --otp=$otp
done
