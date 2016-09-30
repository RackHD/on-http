# Copyright 2016, EMC, Inc.

FROM rackhd/on-tasks

COPY . /RackHD/on-http/
WORKDIR /RackHD/on-http

RUN mkdir -p ./node_modules \
  && ln -s /RackHD/on-tasks ./node_modules/on-tasks \
  && ln -s /RackHD/on-core ./node_modules/on-core \
  && ln -s /RackHD/on-core/node_modules/di ./node_modules/di \
  && apt-get install -y unzip curl \
  && npm install --ignore-scripts \
  && npm install apidoc \
  && npm run apidoc \
  && npm run taskdoc \
  && /RackHD/on-http/install-web-ui.sh \
  && /RackHD/on-http/install-swagger-ui.sh \
  && npm prune --production

EXPOSE 9080 9090
VOLUME /RackHD/on-http/static/http/common
CMD [ "node", "/RackHD/on-http/index.js" ]
