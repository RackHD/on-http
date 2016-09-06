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
        'Errors',
        '_'
    )
);

function tagApiServiceFactory(
    waterline,
    Promise,
    workflowApiService,
    Errors,
    _
) {
    function TagApiService() {
    }

    TagApiService.prototype.findTags = function(query) {
        return waterline.tags.find(query);
    };

    TagApiService.prototype.getTag = function(name) {
        return waterline.tags.findOne({name: name})
        .then(function(tag) {
            if(!tag) {
                throw new Errors.NotFoundError('name ' + name + ' was not found');
            }
            return tag;
        });
    };

    TagApiService.prototype.destroyTag = function(name) {
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
        var query = node ? {id: node} : {};
        return waterline.nodes.find(query)
        .then(function(nodes) {
            var workflowConfig = {
                name: 'Graph.GenerateTags',
                options: {
                    'generate-tag': {},
                }
            };

            if (!nodes || !nodes.length) {
                return;
            } else {
                workflowConfig.options['generate-tag'].nodeIds = _.map(nodes, 'id');
            }

            return workflowApiService.createAndRunGraph(workflowConfig);
        });
    };

    return new TagApiService();
}
