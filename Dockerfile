FROM node:12-alpine

ENV NODE_ENV production

WORKDIR /quickchart

RUN echo "http://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories

RUN apk add --no-cache --virtual .build-deps yarn git build-base g++ python
RUN apk add --no-cache --virtual .npm-deps cairo-dev pango-dev libjpeg-turbo-dev
RUN apk add --no-cache --virtual .fonts libmount ttf-dejavu ttf-droid ttf-freefont ttf-liberation ttf-ubuntu-font-family font-noto font-noto-emoji fontconfig
RUN apk add wqy-zenhei --no-cache --repository http://nl.alpinelinux.org/alpine/edge/testing --allow-untrusted
RUN apk add --no-cache --virtual .runtime-deps graphviz

COPY package*.json .
COPY yarn.lock .
RUN yarn install --production

RUN apk update
RUN rm -rf /var/cache/apk/* && \
    rm -rf /tmp/*
RUN apk del .build-deps

COPY *.js ./
COPY lib/*.js lib/
COPY LICENSE .

EXPOSE 3400

ENTRYPOINT ["node", "--max-http-header-size=65536", "index.js"]
