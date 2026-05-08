#!/bin/bash

# Temporary forked from nuxt/framework

set -xe

TAG=${1:-latest}

# turn off git checks
echo "gitChecks: false" >> ~/pnpm-workspace.yaml

# Bump versions to edge
node ./scripts/bump-edge.mjs

# Release packages
echo "Publishing package..."
pnpm publish --ignore-scripts --access public --tag $TAG
