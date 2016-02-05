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
RUN cp -a /tmp/node_modules /RackHD/on-http/

RUN cd /RackHD/on-http && npm install apidoc && npm run apidoc

RUN mkdir -p /RackHD/on-http/static/http/common
ADD https://bintray.com/artifact/download/rackhd/binary/builds/base.trusty.3.16.0-25-generic.squashfs.img \
    /RackHD/on-http/static/http/common/base.trusty.3.16.0-25-generic.squashfs.img
ADD https://bintray.com/artifact/download/rackhd/binary/builds/discovery.overlay.cpio.gz \
    /RackHD/on-http/static/http/common/discovery.overlay.cpio.gz
ADD https://bintray.com/artifact/download/rackhd/binary/builds/initrd.img-3.16.0-25-generic \
    /RackHD/on-http/static/http/common/initrd.img-3.16.0-25-generic
ADD https://bintray.com/artifact/download/rackhd/binary/builds/vmlinuz-3.16.0-25-generic \
    /RackHD/on-http/static/http/common/vmlinuz-3.16.0-25-generic

RUN apt-get update \
  && apt-get install -y unzip \
  && /RackHD/on-http/install-web-ui.sh

EXPOSE 80
EXPOSE 443

ENTRYPOINT [ "node" ]
CMD [ "/RackHD/on-http/index.js" ]
