// Copyright 2016, EMC Inc.

'use strict';

var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var nodes = injector.get('Http.Services.Api.Nodes');
var tags = injector.get('Http.Services.Api.Tags');
var _ = injector.get('_'); // jshint ignore:line

var getAllTags = controller(function(req) {
    return tags.findTags(req.query);
});

var createTag = controller({success: 201}, function(req) {
    return tags.findTags({name: req.swagger.params.body.value.name}).then(function(tag) {
        if(_.isEmpty(tag)) {
            return tags.createTag(req.swagger.params.body.value).then(function() {
                return tags.regenerateTags();
            });
        }
    }).then(function() {
        return req.swagger.params.body.value;
    });
});

var getTag = controller(function(req) {
    return tags.getTag(req.swagger.params.tagName.value);
});

var deleteTag = controller({success: 204}, function(req) {
    return tags.destroyTag(req.swagger.params.tagName.value);
});

var getNodesByTag = controller(function(req) {
    return nodes.getNodesByTag(req.swagger.params.tagName.value);
});

var postWorkflowById = controller({success: 202}, function(req) {
    return nodes.getNodesByTag(req.swagger.params.tagName.value).map(function(node) {
        return nodes.setNodeWorkflow(node.id,
            req.swagger.params.name.value || req.swagger.params.body.value.name,
            req.swagger.params.body.value.options);
    });
});

module.exports = {
    getAllTags: getAllTags,
    createTag: createTag,
    getTag: getTag,
    deleteTag: deleteTag,
    getNodesByTag: getNodesByTag,
    postWorkflowById: postWorkflowById
};
