// Copyright 2015, EMC, Inc.

"use strict";

var _ = require('lodash'),
    _di = require('di'),
    express = require('express'),
    onCore = require('on-core'),
    onTasks = require('on-tasks'),
    ws = require('ws');

module.exports = onHttpContextFactory;

function onHttpContextFactory(di, directory) {
    di = di || _di;

    var core = onCore(di, directory),
        helper = core.helper;

    return {
        expressApp: function () {
            return helper.simpleWrapper(express(), 'express-app', undefined, __dirname);
        },

        helper: helper,

        initialize: function () {
            var injector = new di.Injector(_.flatten([
                core.injectables,
                this.prerequisiteInjectables,
                this.expressApp(),
                this.injectables
            ]));

            this.app = injector.get('app'),
            this.injector = injector;
            this.logger = injector.get('Logger').initialize('Http.Server');

            return this;
        },

        injectables: _.flatten([
            helper.requireGlob(__dirname + '/lib/**/*.js'),
            require('./app')
        ]),

        prerequisiteInjectables: _.flatten([
            onTasks.injectables,
            helper.simpleWrapper(ws, 'ws'),
            helper.simpleWrapper(ws.Server, 'WebSocketServer')
        ])
    };
}

if (require.main === module) { run(); }

function run() {
    var onHttpContext = onHttpContextFactory().initialize(),
        app = onHttpContext.app,
        logger = onHttpContext.logger;

    app.start()
        .then(function () {
            logger.info('Server Started.');
        })
        .catch(function(error) {
            logger.critical('Server Startup Error.', { error: error });

            process.nextTick(function() {
                process.exit(1);
            });
        });

    process.on('SIGINT', function() {
        http.stop()
            .catch(function(error) {
                logger.critical('Server Shutdown Error.', { error: error });
            })
            .finally(function() {
                process.nextTick(function() {
                    process.exit(1);
                });
            });
    });
}
