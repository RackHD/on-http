#!/bin/sh -ex
./alpha/set_dependencies.sh
service rabbitmq-server start
/usr/bin/mongod --fork --logpath /var/log/mongodb/monngod.log 
./install-swagger-ui.sh
npm install
./node_modules/.bin/_mocha $(find spec -name '*-spec.js') --timeout 10000 --require spec/helper.js
