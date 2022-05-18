ARG NODE_VERSION=lts

FROM node:${NODE_VERSION}-alpine AS app

# Cookie Secret environment required to build nuxt application
# Other environment variables needed but are fine to include as build args as they would not be secret.

RUN apk add --no-cache \
  git \
  python3 \
  make \
  g++

RUN ln -sf python3 /usr/bin/python

WORKDIR /app

COPY . .

RUN yarn install \
  --prefer-offline \
  --frozen-lockfile \
  --non-interactive \
  --network-timeout 60000

ENV HOST 0.0.0.0
EXPOSE 3000

CMD ["yarn", "dev"]
