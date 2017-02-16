// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var schemaApiService = injector.get('Http.Api.Services.Schema');
var nameSpace = '/api/2.0/ibms/definitions/';
var waterline = injector.get('Services.Waterline');
var eventsProtocol = injector.get('Protocol.Events');
var Errors = injector.get('Errors');
var _ = injector.get('_'); // jshint ignore:line


// GET /api/2.0/ibms
var ibmsGet = controller(function(req) {
    return waterline.ibms.find(req.query);
});

// PUT /api/2.0/ibms
var ibmsPut = controller({success: 201}, function(req) {
    var nodeId = req.swagger.params.body.value.nodeId;
    delete req.swagger.params.body.value.nodeId;
    return waterline.ibms.upsertByNode(nodeId, req.swagger.params.body.value);
});

// GET /api/2.0/ibms/identifier
var ibmsGetById = controller(function(req) {
    return waterline.ibms.needByIdentifier(req.swagger.params.identifier.value);
});

// PATCH /api/2.0/ibms/identifier
var ibmsPatchById = controller( function(req) {
    var ibmId = req.swagger.params.identifier.value;
    var values = req.swagger.params.body.value;
    return waterline.ibms.needByIdentifier(ibmId)
        .then(function(oldIbm) {
            /* Get nodes that need to publish events */
            if (oldIbm.node && !values.nodeId) {
                return Promise.all([waterline.nodes.getNodeById(oldIbm.node)]);
            } else if (!oldIbm.node && values.nodeId) {
                return Promise.all([waterline.nodes.getNodeById(values.node)]);
            } else if (oldIbm.node && values.nodeId && oldIbm.node === values.nodeId) {
                return Promise.all([waterline.nodes.getNodeById(oldIbm.node)]);
            } else if (oldIbm.node && values.nodeId && oldIbm.node !== values.nodeId) {
                return Promise.all([waterline.nodes.getNodeById(oldIbm.node),
                        waterline.nodes.getNodeById(values.nodeId)]);
            }
        })
        .then(function(oldNodes) {
            return waterline.ibms.updateByIdentifier(ibmId, values)
            .tap(function() {
                /* Publish events of nodes got beofre update */
                _.forEach(oldNodes, function(oldNode) {
                    if (oldNode) {
                        /* asynchronous, don't wait promise return for performance*/
                        return waterline.nodes.getNodeById(oldNode.id)
                        .then(function(newNode) {
                            return eventsProtocol.publishNodeAttrEvent(oldNode, newNode, 'ibms');
                        })
                        .catch(function (error) {
                            throw new Errors.BaseError('Error Occured', error.message);
                        });
                    }
                });
            });
        });
});

// DELETE /api/2.0/ibms/identifier
var ibmsDeleteById = controller({success: 204}, function(req) {
    var ibmId = req.swagger.params.identifier.value;
    return waterline.ibms.needByIdentifier(ibmId)
        .then(function (ibm) {
            return waterline.nodes.getNodeById(ibm.node);
        })
        .then(function (oldNode) {
            return waterline.ibms.destroyByIdentifier(ibmId)
            .tap(function () {
                if (oldNode) {
                    /* asynchronous, don't wait promise return for performance*/
                    waterline.nodes.getNodeById(oldNode.id)
                    .then(function (newNode) {
                        return eventsProtocol.publishNodeAttrEvent(oldNode, newNode, 'ibms');
                    })
                    .catch(function (error) {
                        throw new Errors.BaseError('Error Occured', error.message);
                    });
                }
            });
        });

});

// GET /ibms/definitions
var ibmsDefinitionsGetAll = controller(function() {
    return schemaApiService.getNamespace(nameSpace);
});

// GET /ibms/definitions/{name}
var ibmsDefinitionsGetByName = controller(function(req) {
    var schemaUid = nameSpace + req.swagger.params.name.value;
    var schema = schemaApiService.getSchema(schemaUid);
    if (schema) {
        return schema;
    }
    throw new Errors.NotFoundError(schemaUid + ' Not Found');
});

module.exports = {
    ibmsGet: ibmsGet,
    ibmsPut: ibmsPut,
    ibmsGetById: ibmsGetById,
    ibmsPatchById: ibmsPatchById,
    ibmsDeleteById: ibmsDeleteById,     
    ibmsDefinitionsGetAll: ibmsDefinitionsGetAll,
    ibmsDefinitionsGetByName: ibmsDefinitionsGetByName
};
