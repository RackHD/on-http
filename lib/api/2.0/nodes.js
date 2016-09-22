// Copyright 2016, EMC Inc.

'use strict';

var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var addLinks = injector.get('Http.Services.Swagger').addLinksHeader;
var nodes = injector.get('Http.Services.Api.Nodes');
var waterline = injector.get('Services.Waterline');
var workflowApiService = injector.get('Http.Services.Api.Workflows');
var _ = injector.get('_'); // jshint ignore:line
var constants = injector.get('Constants');
var Errors = injector.get('Errors');

var nodesGetAll = controller(function(req, res) {
    var options = {
        skip: req.swagger.query.$skip,
        limit: req.swagger.query.$top
    };
    return nodes.getAllNodes(req.query, options)
    .tap(function(nodes) {
        return addLinks(req, res, 'nodes', req.query);
    });
});

var nodesPost = controller({success: 201}, function(req) {
    return nodes.postNode(req.body);
});

var nodesGetById = controller(function(req) {
    return nodes.getNodeById(req.swagger.params.identifier.value);
});

var nodesPatchById = controller(function(req) {
    return nodes.patchNodeById(req.swagger.params.identifier.value, req.body);
});

var nodesDelById = controller({success: 204}, function(req) {
    return nodes.delNodeById(req.swagger.params.identifier.value);
});

var nodesGetSshById = controller(function(req) {
    return nodes.getNodeSshById(req.swagger.params.identifier.value);
});

var nodesPostSshById = controller({success: 201}, function(req) {
    return nodes.postNodeSshById(req.swagger.params.identifier.value, req.body);
});

var nodesGetCatalogById = controller(function(req) {
    return nodes.getNodeCatalogById(req.swagger.params.identifier.value, req.query);
});

var nodesGetCatalogSourceById = controller(function(req) {
    return nodes.getNodeCatalogSourceById(req.swagger.params.identifier.value,
                                          req.swagger.params.source.value);
});

var nodesGetPollersById = controller(function(req) {
    return nodes.getPollersByNodeId(req.swagger.params.identifier.value);
});

var nodesGetWorkflowById = controller(function(req) {
    var newQuery;
    var swaggerQuery = req.swagger.query || [];
    if (_(swaggerQuery).has('active')) {
        if (swaggerQuery.active) {
            newQuery = ({
                _status: constants.Task.ActiveStates
            });
        } else {
            newQuery = ({
                _status: {'!': constants.Task.ActiveStates}
            });
        }
        newQuery = _.merge({}, newQuery, req.query);
    } else {
        newQuery = req.query;
    }

    return workflowApiService.getWorkflowsByNodeId(req.swagger.params.identifier.value,
                                                   newQuery);

});

var nodesPostWorkflowById = controller({success: 201}, function(req) {
    var config = _.defaults(
        req.swagger.params.name.value ? { name: req.swagger.params.name.value } : {},
        req.swagger.params.body.value || {}
    );
    return nodes.setNodeWorkflow(config, req.swagger.params.identifier.value);
});

var nodesWorkflowActionById = controller({success: 202}, function(req, res) {
    var command = req.body.command;

    var actionFunctions = {
        cancel: function() {
            return nodes.delActiveWorkflowById(req.swagger.params.identifier.value)
                .then(function(graph) {
                    res.setHeader('Location', '/api/2.0/workflows/' + graph.id);
                    return graph;
                });
        }
    };

    if(!_(actionFunctions).has(command)) {
        throw new Errors.BadRequestError(
            command + ' is not a valid workflow action'
        );
    }
    return actionFunctions[command]();

});

var nodesGetTagsById = controller(function(req) {
    return nodes.getTagsById(req.swagger.params.identifier.value);
});

var nodesDelTagById = controller({success: 204}, function(req) {
    return nodes.removeTagsById(req.swagger.params.identifier.value,
                                req.swagger.params.tagName.value);
});

var nodesPatchTagById = controller(function(req) {
    return nodes.addTagsById(req.swagger.params.identifier.value,
                             req.body.tags);
});

var nodesMasterDelTagById = controller({success: 204}, function(req) {
    return nodes.masterDelTagById(req.swagger.params.tagName.value);
});

var nodesDelRelations = controller(function(req) {
   return nodes.editNodeRelations(req.swagger.params.identifier.value,
           req.body,
           nodes._removeRelation
        );
});

var nodesAddRelations = controller(function(req) {
   return nodes.editNodeRelations(req.swagger.params.identifier.value,
           req.body,
           nodes._addRelation
        );
});

var nodesGetRelations = controller(function(req) {
   return nodes.getNodeRelations(req.swagger.params.identifier.value);
});

var nodesGetObmsByNodeId = controller(function(req) {
    return nodes.getObmsByNodeId(req.swagger.params.identifier.value);
});

var nodesPutObmsByNodeId = controller({success: 201}, function(req) {
    return nodes.putObmsByNodeId(req.swagger.params.identifier.value, req.body);
});

module.exports = {
    nodesGetAll: nodesGetAll,
    nodesPost: nodesPost,
    nodesGetById: nodesGetById,
    nodesPatchById: nodesPatchById,
    nodesDelById: nodesDelById,
    nodesGetSshById: nodesGetSshById,
    nodesPostSshById: nodesPostSshById,
    nodesGetCatalogById: nodesGetCatalogById,
    nodesGetCatalogSourceById: nodesGetCatalogSourceById,
    nodesGetPollersById: nodesGetPollersById,
    nodesGetWorkflowById: nodesGetWorkflowById,
    nodesPostWorkflowById: nodesPostWorkflowById,
    nodesWorkflowActionById: nodesWorkflowActionById,
    nodesGetTagsById: nodesGetTagsById,
    nodesDelTagById: nodesDelTagById,
    nodesPatchTagById: nodesPatchTagById,
    nodesMasterDelTagById: nodesMasterDelTagById,
    nodesDelRelations: nodesDelRelations,
    nodesAddRelations: nodesAddRelations,
    nodesGetRelations: nodesGetRelations,
    nodesGetObmsByNodeId: nodesGetObmsByNodeId,
    nodesPutObmsByNodeId: nodesPutObmsByNodeId
};
