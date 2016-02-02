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
        'fileService',
        'Promise',
        'Http.Services.SkuPack'
    )
);
function Runner(
    HttpService,
    core,
    configuration,
    profiles,
    templates,
    fileService,
    Promise,
    skuPack
) {
    var services = [];

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
                var endpoints = configuration.get('httpEndpoints', [{port: 8080}]);
                return Promise.map(endpoints, function(endpoint) {
                    var service = new HttpService(endpoint);
                    services.push(service);
                    return Promise.resolve().then(function () {
                        return service.createSwagger();
                    }).then(function () {
                        return service.start();
                    });
                });
            });
    }

    function stop() {
        return Promise.map(services, function(service) {
             return service.stop();
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
