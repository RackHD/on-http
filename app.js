// Copyright 2015, EMC, Inc.
/* jshint node: true */

"use strict";

var di = require('di');

module.exports = Runner;

di.annotate(Runner, new di.Provide('app'));
di.annotate(Runner, new di.Inject(
        'Constants',
        'Http.Server',
        'Services.Core',
        'Services.Configuration',
        'Profiles',
        'Templates',
        'Views',
        'fileService',
        'Promise',
        'Http.Services.SkuPack',
        'Http.Services.Api.Account',
        'Http.Services.uPnP'
    )
);
function Runner(
    constants,
    HttpService,
    core,
    configuration,
    profiles,
    templates,
    views,
    fileService,
    Promise,
    skuPack,
    accountService,
    uPnPService
) {
    var services = [];

    function start() {
        return core.start()
            .then(function() {
                return Promise.all([views.load()]);
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
                return skuPack.start(configuration.get('skuPackRoot', 
                           constants.HttpStaticDir.skupack));
            })
            .then(function() {
                return accountService.start();
            })
            .then(function() {
                if(configuration.get('enableUPnP', true)) {
                    return uPnPService.start();
                }
            })
            .then(function() {
                var endpoints = configuration.get('httpEndpoints', [{port: 8080}]);
                services = Promise.map(endpoints, function(endpoint) {
                    return new HttpService(endpoint);
                }).each(function(service) {
                    return service.createSwagger().then(function() {
                        return service.start();
                    });
                });
                return services;
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
