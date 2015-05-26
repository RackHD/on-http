// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node: true */

"use strict";

var di = require('di');

module.exports = Runner;

di.annotate(Runner, new di.Provide('Http'));
di.annotate(Runner, new di.Inject(
        'Http.Server',
        'Services.Core',
        'Services.Configuration',
        'Profiles',
        'Templates',
        'common-api-router',
        'fileService',
        'Q',
        'Services.StatsD'
    )
);
function Runner(
    app,
    core,
    configuration,
    profiles,
    templates,
    router,
    fileService,
    Q,
    statsd
) {

    function start() {
        return core.start()
            .then(function() {
                return Q.all([profiles.load(), templates.load()]);
            })
            .then(function() {
                statsd.gauge('hello.world', 1);
console.log('metric sent');
                app.use('/api/common', router);
                app.use('/api/current', router);
                app.use('/api/1.1', router);

                return fileService.start(configuration.get("fileService"));
            })
            .then(function() {
                app.listen();
            });
    }

    function stop() {
        return Q.resolve()
            .then(function() {
                return app.close();
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
