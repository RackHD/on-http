# Copyright 2016, EMC, Inc.

FROM rackhd/on-core

COPY . /RackHD/on-http/
WORKDIR /RackHD/on-http

RUN mkdir -p ./node_modules \
  && ln -s /RackHD/on-core ./node_modules/on-core \
  && ln -s /RackHD/on-core/node_modules/di ./node_modules/di \
  && npm install --ignore-scripts --production \
  && npm install apidoc && npm run apidoc && npm run taskdoc \
  && echo "@testing http://nl.alpinelinux.org/alpine/edge/testing" >> /etc/apk/repositories \
  && apk add --update ipmitool@testing unzip \
  && /RackHD/on-http/install-web-ui.sh \
  && /RackHD/on-http/install-swagger-ui.sh

EXPOSE 9080 9090
VOLUME /RackHD/on-http/static/http/common
CMD [ "node", "/RackHD/on-http/index.js" ]
