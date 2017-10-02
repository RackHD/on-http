// Copyright 2016, EMC Inc.

'use strict';

var injector = require('../../../index').injector;
var swagger = injector.get('Http.Services.Swagger');
var controller = swagger.controller;
var templates = injector.get('Templates');
var templateApiService = injector.get('Http.Services.Api.Templates');
var taskgraphApiService = injector.get('Http.Services.Api.Taskgraph.Scheduler');

// GET /templates/metadata
var templatesMetaGet = controller(function() {
    return templateApiService.templatesMetaGet();
});

// GET /templates/metadata/:name
var templatesMetaGetByName = controller(function(req) {
    return templateApiService.templatesMetaGetByName(req.swagger.params.name.value,
        req.swagger.query.scope);
});


// GET /templates/library/:name
var templatesLibGet = controller(function(req) {
    return templateApiService.templatesLibGet(req.swagger.params.name.raw, req.swagger.query.scope);
});

// PUT /templates/library/:name
var templatesLibPut = controller({success: 201}, function(req) {
    return templateApiService.templatesLibPut(req.swagger.params.name.raw, req, req.swagger.query.scope);
});

// DELETE /templates/library/:name
var templatesLibDelete = controller(function(req) {
    return taskgraphApiService.templatesLibDelete(req.swagger.params.name.value,
                            req.swagger.query.scope);
});

module.exports = {
    templatesMetaGet: templatesMetaGet,
    templatesMetaGetByName: templatesMetaGetByName,
    templatesLibGet: templatesLibGet,
    templatesLibPut: templatesLibPut,
    templatesLibDelete: templatesLibDelete
};
