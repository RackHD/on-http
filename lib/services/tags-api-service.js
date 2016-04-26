// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di');

module.exports = tagApiServiceFactory;

di.annotate(tagApiServiceFactory, new di.Provide('Http.Services.Api.Tags'));
di.annotate(tagApiServiceFactory,
    new di.Inject(
        'Services.Waterline',
        'Promise',
        'Http.Services.Api.Workflows',
        'Errors'
    )
);

function tagApiServiceFactory(
    waterline,
    Promise,
    workflowApiService,
    Errors
) {
    function TagApiService() {
    }

    TagApiService.prototype.findTags = function(query) {
        return waterline.tags.find(query);
    };

    TagApiService.prototype.getTag = function(name) {
        name = decodeURIComponent(name);
        return waterline.tags.findOne({name: name})
        .then(function(tag) {
            if(!tag) {
                throw new Errors.NotFoundError('name ' + name + ' was not found');
            }
            return tag;
        });
    };

    TagApiService.prototype.destroyTag = function(name) {
        name = decodeURIComponent(name);
        return waterline.tags.findOne({name: name})
        .then(function(tag) {
            if(!tag) {
                throw new Errors.NotFoundError('name ' + name + ' was not found');
            }
            return waterline.tags.destroy({name: name});
        });
    };

    TagApiService.prototype.createTag = function(options) {
        return waterline.tags.create(options);
    };

    TagApiService.prototype.regenerateTags = function(node) {
        node = node ? {id: node} : {};
        return Promise.map(waterline.nodes.find(node), function(node) {
            return workflowApiService.createAndRunGraph({
                options: {
                    'generate-tag': {
                        nodeId: node.id
                    }
                },
                name: 'Graph.GenerateTags'
            });
        });
    };

    return new TagApiService();
}
