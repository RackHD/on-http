// Copyright 2016, EMC Inc.

'use strict';

var injector = require('../../../index').injector;
var swagger = injector.get('Http.Services.Swagger');
var controller = swagger.controller;
var templates = injector.get('Templates');
var taskProtocol = injector.get('Protocol.Task');
var Errors = injector.get('Errors');
var lookups = injector.get('Services.Lookup');
var _ = injector.get('_');
var waterline = injector.get('Services.Waterline');
var workflowApiService = injector.get('Http.Services.Api.Workflows');

// GET /templates/metadata
var templatesMetaGet = controller(function() {
    return templates.getAll();
});

// GET /templates/metadata/:name
var templatesMetaGetByName = controller(function(req) {
    return templates.getName(req.swagger.params.name.value,
                             req.swagger.query.scope);
});

// GET /templates/:name
var templatesGetByName = controller(function(req, res) {
    return lookups.ipAddressToMacAddress(res.locals.ipAddress)
    .then(function(mac) {
        return waterline.nodes.needByIdentifier(mac);
    })
    .then(function(node) {
        return Promise.all([
            workflowApiService.findActiveGraphForTarget(node.id),
            node
        ]);
    })
    .spread(function(workflow, node) {
        if (!workflow) {
            throw new Errors.NotFoundError('no active workflow');
        }
        return Promise.all([
            swagger.makeRenderableOptions(req, res, workflow.context),
            taskProtocol.requestProperties(node.id)
        ]);
    })
    .spread(function(options, properties) {
        return templates.render(
            req.swagger.params.name.value,
            _.merge({}, options, properties),
           res.locals.scope
        ) ;
    });
});

// GET /templates/library/:name
var templatesLibGet = controller(function(req) {
    return templates.get(req.swagger.params.name.value,
                         req.swagger.query.scope)
    .then(function(template) {
        if (!template || !template.contents) {
            throw new Errors.NotFoundError('template not found');
        }
        return template.contents;
    });
});

// PUT /templates/library/:name
var templatesLibPut = controller({success: 201}, function(req) {
    return templates.put(req.swagger.params.name.value,
                         req,
                         req.swagger.query.scope);
});

// DELETE /templates/library/:name
var templatesLibDelete = controller(function(req) {
    return templates.unlink(req.swagger.params.name.value,
                            req.swagger.query.scope);
});

module.exports = {
    templatesMetaGet: templatesMetaGet,
    templatesMetaGetByName: templatesMetaGetByName,
    templatesGetByName: templatesGetByName,
    templatesHeadByName: templatesGetByName,
    templatesLibGet: templatesLibGet,
    templatesLibPut: templatesLibPut,
    templatesLibDelete: templatesLibDelete
};
