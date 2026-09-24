#!/bin/bash

set -xe

VERSION=$(node -p "require('./package.json').version")
TAG_VERSION=${GITHUB_REF_NAME#v}

if [ "$VERSION" != "$TAG_VERSION" ]; then
  echo "The tag ${GITHUB_REF_NAME} does not match the package version ${VERSION}."
  exit 1
fi

DIST_TAG=latest
case "$VERSION" in
  *-*) DIST_TAG=$(node -p "require('./package.json').version.split('-')[1].split('.')[0]") ;;
esac

echo "gitChecks: false" >> ~/pnpm-workspace.yaml

echo "Publishing @cwa/nuxt@${VERSION} under the ${DIST_TAG} tag..."
pnpm publish --ignore-scripts --access public --tag "$DIST_TAG"
