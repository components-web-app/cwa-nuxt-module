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

echo "Staging @cwa/nuxt@${VERSION} under the ${DIST_TAG} tag. It goes live once approved on npmjs.com."
npx -y npm@^11.15 stage publish --ignore-scripts --access public --tag "$DIST_TAG" --provenance
