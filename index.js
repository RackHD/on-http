// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint: node:true */

'use strict';

var di = require('di'),
    _ = require('lodash'),
    core = require('on-core')(di),
    tasks = require('on-tasks'),
    injector = new di.Injector(
        _.flatten([
            core.injectables,
            tasks.injectables,
            core.helper.simpleWrapper(require('express')(), 'express-app', undefined, __dirname),
            core.helper.requireGlob(__dirname + '/lib/**/*.js'),
            require('./app')
        ])
    ),
    http = injector.get('Http'),
    logger = injector.get('Logger').initialize('Http.Server');

http.start()
    .then(function () {
        logger.info('Server Started.');
    })
    .catch(function(error) {
        logger.error('Server Startup Error.', { error: error });

        process.nextTick(function() {
            process.exit(1);
        });
    });

process.on('SIGINT', function() {
    http.stop()
        .catch(function(error) {
            logger.error('Server Shutdown Error.', { error: error });
        })
        .finally(function() {
            process.nextTick(function() {
                process.exit(1);
            });
        });
});
