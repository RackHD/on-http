# on-http [![Build Status](https://travis-ci.org/RackHD/on-http.svg?branch=master)](https://travis-ci.org/RackHD/on-http) [![Code Climate](https://codeclimate.com/github/RackHD/on-http/badges/gpa.svg)](https://codeclimate.com/github/RackHD/on-http) [![Coverage Status](https://coveralls.io/repos/RackHD/on-http/badge.svg?branch=master&service=github)](https://coveralls.io/github/RackHD/on-http?branch=master)

__`on-http` is the HTTP server for RackHD__

_Copyright 2015, EMC, Inc._

## Installation

    rm -rf node_modules
    npm install
    npm run apidoc

## Running

Note: requires MongoDB and RabbitMQ to be running to start correctly.

    sudo node index.js

 * http://127.0.0.1/ui -- RackHD Web UI
 * http://127.0.0.1/docs -- RackHD Docs

## Config

The `fileService` requires a "fileService" key which holds keys mapping backend
strings to their individual config values; it requires at least "defaultBackend"
 to be among the backend keys. More strings may be added and mapped to
injector strings in the `fileSevice.injectorMap` attribute.

## Debugging/Profiling

To run in debug mode to debug routes and middleware:

    sudo DEBUG=express:* node --debug index.js

If you're using Node v4 or greater you can use `node-inspector` to debug and profile from a GUI.

    npm install node-inspector -g
    node-inspector --preload=false &
    sudo DEBUG=express:* node --debug-brk index.js

Note: do not use the `node-debug` command it doesn't work as well.

## CI/Testing

To run tests from a developer console:

    npm test

To run tests and get coverage for CI:

    # verify hint/style
    ./node_modules/.bin/jshint -c .jshintrc --reporter=checkstyle lib index.js > checkstyle-result.xml || true
    ./node_modules/.bin/istanbul cover -x "**/spec/**" _mocha -- $(find spec -name '*-spec.js') -R xunit-file --require spec/helper.js
    ./node_modules/.bin/istanbul report cobertura
    # if you want HTML reports locally
    ./node_modules/.bin/istanbul report html
