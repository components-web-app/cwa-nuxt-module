#!/bin/bash

# Temporary forked from nuxt/framework

set -xe

# Bump versions to edge
node ./scripts/bump-edge.mjs

# Update token
if [[ ! -z ${NPM_AUTH_TOKEN} ]] ; then
  echo "//registry.npmjs.org/:_authToken=${NPM_AUTH_TOKEN}" >> ~/.npmrc
  echo "registry=https://registry.npmjs.org/" >> ~/.npmrc
  pnpm whoami
fi

# Release packages
echo "Publishing package..."
pnpm publish --access public --otp=${NPM_OTP} --tag=edge
