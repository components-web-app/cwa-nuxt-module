#!/bin/bash

# Temporary forked from nuxt/framework

set -xe

TAG=${1:-latest}

# turn off git checks
echo "gitChecks: false" >> ~/pnpm-workspace.yaml

# Update token
if [[ ! -z ${NPM_AUTH_TOKEN} ]] ; then
  echo "//registry.npmjs.org/:_authToken=${NPM_AUTH_TOKEN}" >> ~/.npmrc
  echo "registry=https://registry.npmjs.org/" >> ~/.npmrc
fi

# Bump versions to edge
node ./scripts/bump-edge.mjs

# Release packages
echo "Publishing package..."
pnpm publish --access public --otp=${NPM_OTP} --tag $TAG
