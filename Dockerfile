ARG NODE_VERSION=lts

FROM node:${NODE_VERSION}-alpine AS app

# Cookie Secret environment required to build nuxt application
# Other environment variables needed but are fine to include as build args as they would not be secret.

RUN apk update && \
  apk add --no-cache \
  git \
  python3 \
  make \
  g++ \
  openssl \
  bind-tools

RUN ln -sf python3 /usr/bin/python

WORKDIR /app

COPY . .

RUN mkdir -p playground/ssl/
RUN ./playground/dev-ssl.sh

RUN npm install && npm cache clean --force
RUN cd playground && npm install && npm cache clean --force

EXPOSE 3000

COPY ./docker-start.sh /usr/local/bin/docker-start
RUN chmod +x /usr/local/bin/docker-start

ENTRYPOINT ["docker-start"]
