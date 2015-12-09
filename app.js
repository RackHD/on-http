// Copyright 2015, EMC, Inc.
/* jshint node: true */

"use strict";

var di = require('di');

module.exports = Runner;

di.annotate(Runner, new di.Provide('app'));
di.annotate(Runner, new di.Inject(
        'Http.Server',
        'Services.Core',
        'Services.Configuration',
        'Profiles',
        'Templates',
        'common-api-router',
        'fileService',
        'Promise',
        'Http.Services.SkuPack'
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
    Promise,
    skuPack
) {

    function start() {
        return core.start()
            .then(function() {
                return Promise.all([profiles.load(), templates.load()]);
            })
            .then(function() {
                return fileService.start({
                    defaultBackend: {
                        type: configuration.get('httpFileServiceType', 'FileSystem'),
                        root: configuration.get('httpFileServiceRoot', './static/files')
                    }
                });
            })
            .then(function() {
                return skuPack.start(configuration.get('skuPackRoot', './skupack.d'));
            })
            .then(function() {
                return app.listen();
            });
    }

    function stop() {
        return Promise.resolve()
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
