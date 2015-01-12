// Copyright 2014, Renasar Technologies Inc.
/* jshint: node:true */

'use strict';

var di = require('di'),
    _ = require('lodash'),
    core = require('renasar-core')(di),
    injector = new di.Injector(
        _.flatten([
            core.injectables,
            // use __dirname workaround so we can npm link in development and still locate things
            core.helper.simpleWrapper(require('express')(), 'express-app', undefined, __dirname),
            core.helper.requireGlob(__dirname + '/lib/**/*.js'),
            require('./app')
        ])
    ),
    http = injector.get('Http');

http.start()
    .catch(function(error) {
        console.error('Failure starting HTTP server: ' + error.stack);
        process.nextTick(function() {
            process.exit(1);
        });
    });

process.on('SIGINT', function() {
    http.stop()
        .catch(function(error) {
            console.error('Failure cleaning up HTTP server: ' + error.stack);
        })
        .fin(function() {
            process.nextTick(function() {
                process.exit(1);
            });
        });
});
