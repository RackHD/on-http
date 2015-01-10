// Copyright 2014, Renasar Technologies Inc.
/* jshint node: true */

"use strict";

var di = require('di');

module.exports = Runner;

di.annotate(Runner, new di.Provide('Http'));
di.annotate(Runner, new di.Inject(
        'Http.Server',
        'Services.Waterline',
        'Services.Messenger',
        'Protocol.Http',
        'Services.Configuration',
        'express-app',
        'common-api-router'
    )
);

function Runner(http, waterline, messenger, httpProtocol, configuration, app, router) {
    function start() {
        return waterline.start()
            .then(function() {
                return messenger.start();
            })
            .then(function() {
                return httpProtocol.start();
            })
            .then(function() {
                app.use('/api/common', router);

                http.listen(configuration.get('httpport'));
            });
    }

    function stop() {
        return waterline.stop()
            .then(function() {
                return messenger.stop();
            });
    }

    return {
        start: start,
        stop: stop
    };
}
