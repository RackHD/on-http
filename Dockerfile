# Copyright 2016, EMC, Inc.

FROM rackhd/on-core

RUN mkdir -p /RackHD/on-http
WORKDIR /RackHD/on-http

COPY ./package.json /tmp/
RUN cd /tmp \
  && ln -s /RackHD/on-core /tmp/node_modules/on-core \
  && ln -s /RackHD/on-core/node_modules/di /tmp/node_modules/di \
  && npm install --ignore-scripts --production

COPY . /RackHD/on-http/
RUN cp -a -f /tmp/node_modules /RackHD/on-http/

RUN cd /RackHD/on-http && npm install apidoc && npm run apidoc

RUN apk add --update unzip \
  && /RackHD/on-http/install-web-ui.sh \
  && /RackHD/on-http/install-swagger-ui.sh

EXPOSE 9080
EXPOSE 9090

VOLUME /RackHD/on-http/static/http/common

CMD [ "node", "/RackHD/on-http/index.js" ]
