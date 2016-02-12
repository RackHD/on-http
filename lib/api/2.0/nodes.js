// Copyright 2016, EMC Inc.

'use strict';

var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var nodes = injector.get('Http.Services.Api.Nodes');

var nodesGetAll = controller(function(req, res) {
    return nodes.getAllNodes(req.query);
});

var nodesPost = controller({success: 201}, function(req, res) {
    return nodes.postNode(req.body);
});

var nodesGetById = controller(function(req, res) {
    return nodes.getNodeById(req.swagger.params.identifier.value);
});

var nodesPatchById = controller(function(req, res) {
    return nodes.patchNodeById(req.swagger.params.identifier.value, req.body);
});

var nodesDelById = controller(function(req, res) {
    return nodes.delNodeById(req.swagger.params.identifier.value);
});

var nodesGetObmById = controller(function(req, res) {
    return nodes.getNodeObmById(req.swagger.params.identifier.value);
});

var nodesPostObmById = controller({success: 201}, function(req, res) {
    return nodes.postNodeObmById(req.swagger.params.identifier.value, req.body);
});

var nodesPostObmIdById = controller(function(req, res) {
    return nodes.postNodeObmIdById(req.swagger.params.identifier.value, req.body);
});

var nodesGetCatalogById = controller(function(req, res) {
    return nodes.getNodeCatalogById(req.swagger.params.identifier.value);
});

var nodesGetCatalogSourceById = controller(function(req, res) {
    return nodes.getNodeCatalogSourceById(req.swagger.params.identifier.value,
                                          req.swagger.params.source.value);
});

var nodesGetPollersById = controller(function(req, res) {
    return nodes.getPollersByNodeId(req.swagger.params.identifier.value);
});

var nodesGetWorkflowById = controller(function(req, res) {
    return nodes.getNodeWorkflowById(req.swagger.params.identifier.value);
});

var nodesPostWorkflowById = controller({success: 201}, function(req, res) {
    //TODO(heckj): how are we assigning a nodes to a workflow - through
    // options? Merge in req.params.identifier?
    var config = _.defaults(req.query || {}, req.body || {});
    return nodes.setNodeWorkflow(req.swagger.params.identifier.value,
                                 req.swagger.params.name.value || req.swagger.params.body.value.name,
                                 config.options);
});

var nodesGetActiveWorkflowById = controller(function(req, res) {
    return nodes.getActiveNodeWorkflowById(req.swagger.params.identifier.value);
});

var nodesDelActiveWorkflowById = controller(function(req, res) {
    return nodes.delActiveWorkflowById(req.swagger.params.identifier.value);
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
    nodesDelActiveWorkflowById: nodesDelActiveWorkflowById
};