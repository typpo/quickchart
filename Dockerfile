FROM node:18-alpine3.17

ENV NODE_ENV production

WORKDIR /quickchart

RUN apk add --upgrade apk-tools
RUN apk add --no-cache --virtual .build-deps yarn git build-base g++ python3
RUN apk add --no-cache --virtual .npm-deps cairo-dev pango-dev libjpeg-turbo-dev librsvg-dev
RUN apk add --no-cache --virtual .fonts libmount ttf-dejavu ttf-droid ttf-freefont ttf-liberation font-noto font-noto-emoji fontconfig
RUN apk add --no-cache --repository https://dl-cdn.alpinelinux.org/alpine/edge/community font-wqy-zenhei
RUN apk add --no-cache libimagequant-dev
RUN apk add --no-cache vips-dev
RUN apk add --no-cache --virtual .runtime-deps graphviz

COPY package*.json .
COPY yarn.lock .
RUN yarn global add node-gyp
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
