# on-http


Monorail HTTP Server

## installation


    rm -rf node_modules
    npm install
    npm run apidoc

## running

Note: requires MongoDB and RabbitMQ to be running to start correctly.

    sudo node index.js
    
## config

the fileService requires a "fileService" key which holds keys mapping backend
strings to their individual config values; it requires at least "defaultBackend"
 to be among the backend keys. More strings may be added and mapped to
injector strings in the fileSevice.injectorMap attribute.

## debuging

To run in debug mode to debug routes and middleware:


    sudo DEBUG=express:* node --debug index.js

## CI/testing

To run tests from a developer console:


    npm test

To run tests and get coverage for CI:


    # verify hint/style
    ./node_modules/.bin/jshint -c .jshintrc --reporter=checkstyle lib index.js > checkstyle-result.xml || true
    ./node_modules/.bin/istanbul cover -x "**/spec/**" _mocha -- $(find spec -name '*-spec.js') -R xunit-file --require spec/helper.js
    ./node_modules/.bin/istanbul report cobertura
    # if you want HTML reports locally
    ./node_modules/.bin/istanbul report html
