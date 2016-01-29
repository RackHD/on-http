// Copyright 2015, EMC, Inc.

"use strict";

var _ = require('lodash'),  /* jshint ignore: line */
    _di = require('di'),
    onCore = require('on-core'),
    onTasks = require('on-tasks'),
    ws = require('ws');

var self = module.exports = {
    injector: null,
    onHttpContextFactory: onHttpContextFactory
};

function onHttpContextFactory(di, directory) {
    di = di || _di;

    var core = onCore(di, directory),
        helper = core.helper;
    return {
        helper: helper,

        initialize: function () {
            var injector = new di.Injector(_.flattenDeep([
                core.injectables,
                this.prerequisiteInjectables,
                this.injectables
            ]));

            this.app = injector.get('app'),
            this.logger = injector.get('Logger').initialize('Http.Server');
            self.injector = injector;

            return this;
        },

        injectables: _.flattenDeep([
            helper.requireGlob(__dirname + '/lib/api/login/*.js'),
            helper.requireGlob(__dirname + '/lib/api/1.1/**/*.js'),
            helper.requireGlob(__dirname + '/lib/services/**/*.js'),
            helper.requireGlob(__dirname + '/lib/serializables/**/*.js'),
            require('./app'),
            helper.requireWrapper('rimraf', 'rimraf', undefined, __dirname),
            helper.requireWrapper('os-tmpdir', 'osTmpdir', undefined, __dirname)
        ]),

        prerequisiteInjectables: _.flattenDeep([
            onTasks.injectables,
            helper.simpleWrapper(ws, 'ws'),
            helper.simpleWrapper(ws.Server, 'WebSocketServer'),
            helper.requireWrapper('swagger-express-mw', 'swagger', undefined, __dirname)
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
        app.stop()
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
