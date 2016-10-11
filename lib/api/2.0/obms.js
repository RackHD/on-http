// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var schemaApiService = injector.get('Http.Api.Services.Schema');
var nameSpace = '/api/2.0/obms/definitions/';
var waterline = injector.get('Services.Waterline');
var Errors = injector.get('Errors');
var nodes = injector.get('Http.Services.Api.Nodes');
var obmsService = injector.get('Http.Services.Api.Obms');
var _ = injector.get('_'); // jshint ignore:line

// GET /obms/definitions
var obmsDefinitionsGetAll = controller(function() {
    return schemaApiService.getNamespace(nameSpace);
});

// GET /obms/definitions/{name}
var obmsDefinitionsGetByName = controller(function(req) {
    var schemaUid = nameSpace + req.swagger.params.name.value;
    var schema = schemaApiService.getSchema(schemaUid);
    if (schema) {
        return schema;
    }
    throw new Errors.NotFoundError(schemaUid + ' Not Found');
});

// GET /api/2.0/obms
var obmsGet = controller(function(req) {
    return waterline.obms.find(req.query);
});

// PUT /api/2.0/obms
var obmsPut = controller({success: 201}, function(req) {
    var nodeId = req.swagger.params.body.value.nodeId;
    delete req.swagger.params.body.value.nodeId;
    return waterline.obms.upsertByNode(nodeId, req.swagger.params.body.value);
});

// GET /api/2.0/obms/identifier
var obmsGetById = controller(function(req) {
    return waterline.obms.needByIdentifier(req.swagger.params.identifier.value);
});

// PATCH /api/2.0/obms/identifier
var obmsPatchById = controller( function(req) {
    return obmsService.updateObmById(
        req.swagger.params.identifier.value, req.swagger.params.body.value);

});

// DELETE /api/2.0/obms/identifier
var obmsDeleteById = controller({success: 204}, function(req) {
    return obmsService.removeObmById(req.swagger.params.identifier.value);
});

// POST /api/2.0/obms/led
var obmsPostLed = controller({success: 201}, function(req) {
    if (_.has(req, 'swagger.params.body.value.nodeId')) {
        var nodeId = req.swagger.params.body.value.nodeId;
        delete req.swagger.params.body.value.nodeId;
        return nodes.postNodeObmIdById(nodeId, req.body);
    } else {
        throw new Errors.BadRequestError('Must specify nodeId in body');
    }
});

module.exports = {
    obmsDefinitionsGetAll: obmsDefinitionsGetAll,
    obmsDefinitionsGetByName: obmsDefinitionsGetByName,
    obmsGet: obmsGet,
    obmsPut: obmsPut,
    obmsGetById: obmsGetById,
    obmsPatchById: obmsPatchById,
    obmsDeleteById: obmsDeleteById,
    obmsPostLed: obmsPostLed
};
