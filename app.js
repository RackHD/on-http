// Copyright 2014, Renasar Technologies Inc.
/* jshint node: true */

"use strict";

var di = require('di');

module.exports = Runner;

di.annotate(Runner, new di.Provide('Http'));
di.annotate(Runner, new di.Inject(
        'Http.Server',
        'Services.Core',
        'Services.Configuration',
        'express-app',
        'common-api-router',
        'Q'
    )
);
function Runner(http, core, configuration, app, router, Q) {
    function start() {
        return core.start()
            .then(function() {
                app.use('/api/common', router);

                http.listen(configuration.get('httpport'));
            });
    }

    function stop() {
        return Q.resolve()
            .then(function() {
                return http.close();
            })
            .then(function() {
                return core.stop();
            });
    }

    return {
        start: start,
        stop: stop
    };
}
