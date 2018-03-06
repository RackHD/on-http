// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved.

'use strict';

var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var getTagName = injector.get('Http.Services.Swagger').getTagName;
var nodes = injector.get('Http.Services.Api.Nodes');
var tags = injector.get('Http.Services.Api.Tags');
var _ = injector.get('_'); // jshint ignore:line
var Errors = injector.get('Errors');

var getAllTags = controller(function(req) {
    return tags.findTags(req.query);
});

var createTag = controller({success: 201}, function(req) {
    return tags.findTags({name: req.swagger.params.body.value.name}).then(function(tag) {
        if(_.isEmpty(tag)) {
            return tags.createTag(req.swagger.params.body.value).then(function() {
                return tags.regenerateTags();
            });
        } else {
            // TODO: Replace with HttpError after errors are refactored
            var err = new Errors.BaseError('tag name already exists');
            err.status = 409;
            throw err;
        }
    }).then(function() {
        return tags.getTag(req.swagger.params.body.value.name);
    });
});

var getTag = controller(function(req) {
    return tags.getTag(getTagName(req));
});

var deleteTag = controller({success: 204}, function(req) {
    return tags.destroyTag(getTagName(req));
});

var getNodesByTag = controller(function(req) {
    return nodes.getNodesByTag(getTagName(req));
});

var postWorkflowById = controller({success: 202}, function(req) {
    return nodes.getNodesByTag(getTagName(req)).map(function(node) {
        var config = _.defaults(
            req.swagger.params.name.value ? { name: req.swagger.params.name.value } : {},
            req.swagger.params.body.value || {}
        );
        return nodes.setNodeWorkflow(config, node.id);
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
