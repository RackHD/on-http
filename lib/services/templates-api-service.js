// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di');


module.exports = templateApiServiceFactory;
di.annotate(templateApiServiceFactory, new di.Provide('Http.Services.Api.Templates'));
di.annotate(templateApiServiceFactory,
    new di.Inject(
        'Promise',
        'Http.Services.Api.Workflows',
        'Protocol.Task',
        'Protocol.Events',
        'Services.Waterline',
        'Services.Configuration',
        'Services.Lookup',
        'Logger',
        'Errors',
        '_',
        'Templates',
        'Services.Environment',
        'Http.Services.Swagger',
        'Constants',
        'Http.Services.Api.Nodes',
        'Http.Services.Api.Taskgraph.Scheduler',
        'crypto'
    )
);
function templateApiServiceFactory(
    Promise,
    workflowApiService,
    taskProtocol,
    eventsProtocol,
    waterline,
    configuration,
    lookupService,
    Logger,
    Errors,
    _,
    templates,
    Env,
    swaggerService,
    Constants,
    nodeApiService,
    taskgraphService,
    crypto
) {
    

    function TemplateApiService() {
    }

    TemplateApiService.prototype.templatesLibGet = function (name, scope) {
        return taskgraphService.templatesLibGet(name, scope);
    };

    TemplateApiService.prototype.templatesLibPut = function (name, body, scope) {
        var self = this;
        return self.FileStreaming(name, body, scope)
            .then (function(data){
                return taskgraphService.templatesLibPut(name, data, scope);
            });
    };

    TemplateApiService.prototype.templatesMetaGet = function () {
        return taskgraphService.templatesMetaGet();
    };

    TemplateApiService.prototype.templatesMetaGetByName = function (name, scope) {
        return taskgraphService.templatesMetaGetByName(name, scope);
    };

    TemplateApiService.prototype.FileStreaming = function (filename, stream) {
        var contents = '';
        var resolve;
        var reject;
        var hash = crypto.createHash('md5');

        var promise = new Promise(function(_resolve, _reject) {
            resolve = _resolve;
            reject = _reject;
        });

        stream.on('data', function(chunk) {
            var chunkStr = chunk.toString('utf-8');
            contents += chunkStr;
            hash.update(chunkStr);
        });

       stream.on('end', function() {
            resolve(contents);
        });

        stream.on('error', function(err) {
            reject(new Errors.InternalServerError(err.message));
        });

        return promise;
    };
    
    return new TemplateApiService();
}
