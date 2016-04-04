// Copyright 2016, EMC Inc.

'use strict';

var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var nodes = injector.get('Http.Services.Api.Nodes');
var _ = injector.get('_'); // jshint ignore:line

var nodesGetAll = controller(function(req) {
    return nodes.getAllNodes(req.query);
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

var nodesDelById = controller(function(req) {
    return nodes.delNodeById(req.swagger.params.identifier.value);
});

var nodesGetObmById = controller(function(req) {
    return nodes.getNodeObmById(req.swagger.params.identifier.value);
});

var nodesPostObmById = controller({success: 201}, function(req) {
    return nodes.postNodeObmById(req.swagger.params.identifier.value, req.body);
});

var nodesPostObmIdById = controller(function(req) {
    return nodes.postNodeObmIdById(req.swagger.params.identifier.value, req.body);
});

var nodesGetCatalogById = controller(function(req) {
    return nodes.getNodeCatalogById(req.swagger.params.identifier.value);
});

var nodesGetCatalogSourceById = controller(function(req) {
    return nodes.getNodeCatalogSourceById(req.swagger.params.identifier.value,
                                          req.swagger.params.source.value);
});

var nodesGetPollersById = controller(function(req) {
    return nodes.getPollersByNodeId(req.swagger.params.identifier.value);
});

var nodesGetWorkflowById = controller(function(req) {
    return nodes.getNodeWorkflowById(req.swagger.params.identifier.value);
});

var nodesPostWorkflowById = controller({success: 201}, function(req) {
    var config = _.defaults(req.query || {}, req.body || {});
    return nodes.setNodeWorkflow(config, req.swagger.params.identifier.value);
});

var nodesGetActiveWorkflowById = controller({ send204OnEmpty: true }, function(req) {
    return nodes.getActiveNodeWorkflowById(req.swagger.params.identifier.value);
});

var nodesDelActiveWorkflowById = controller({success: 204}, function(req) {
    return nodes.delActiveWorkflowById(req.swagger.params.identifier.value);
});

var nodesGetTagsById = controller(function(req) {
    return nodes.getTagsById(req.swagger.params.identifier.value);
});

var nodesDelTagById = controller(function(req) {
    return nodes.removeTagsById(req.swagger.params.identifier.value, 
                                req.swagger.params.tagName.value);
});

var nodesPatchTagById = controller(function(req) {
    return nodes.addTagsById(req.swagger.params.identifier.value,
                             req.swagger.params.body.value.tags);
});

var nodesMasterDelTagById = controller(function(req) {
    return nodes.masterDelTagById(req.swagger.params.tagName.value);
});

module.exports = {
    nodesGetAll: nodesGetAll,
    nodesPost: nodesPost,
    nodesGetById: nodesGetById,
    nodesPatchById: nodesPatchById,
    nodesDelById: nodesDelById,
    nodesGetObmById: nodesGetObmById,
    nodesPostObmById: nodesPostObmById,
    nodesPostObmIdById: nodesPostObmIdById,
    nodesGetCatalogById: nodesGetCatalogById,
    nodesGetCatalogSourceById: nodesGetCatalogSourceById,
    nodesGetPollersById: nodesGetPollersById,
    nodesGetWorkflowById: nodesGetWorkflowById,
    nodesPostWorkflowById: nodesPostWorkflowById,
    nodesGetActiveWorkflowById: nodesGetActiveWorkflowById,
    nodesDelActiveWorkflowById: nodesDelActiveWorkflowById,
    nodesGetTagsById: nodesGetTagsById,
    nodesDelTagById: nodesDelTagById,
    nodesPatchTagById: nodesPatchTagById,
    nodesMasterDelTagById: nodesMasterDelTagById
};
