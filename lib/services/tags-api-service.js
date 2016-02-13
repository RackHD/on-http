// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di');

module.exports = tagApiServiceFactory;

di.annotate(tagApiServiceFactory, new di.Provide('Http.Services.Api.Tags'));
di.annotate(tagApiServiceFactory,
    new di.Inject(
        'Services.Waterline',
        'Protocol.TaskGraphRunner',
        'Promise'
    )
);

function tagApiServiceFactory(
    waterline,
    taskGraphProtocol,
    Promise
) {
    function TagApiService() {
    }

    TagApiService.prototype.findTags = function(query) {
        return waterline.tags.find(query);
    };

    TagApiService.prototype.getTag = function(name) {
        return waterline.tags.findOne({name: name});
    };

    TagApiService.prototype.destroyTag = function(name) {
        return waterline.tags.destroy({name: name});
    };

    TagApiService.prototype.createTag = function(options) {
        return waterline.tags.create(options);
    };

    TagApiService.prototype.regenerateTags = function(node) {
        node = node ? {id: node} : {};
        return Promise.map(waterline.nodes.find(node), function(node) {
            return taskGraphProtocol.runTaskGraph(
                'Graph.GenerateTags',
                { defaults: { nodeId: node.id }}
            );
        });
    };

    return new TagApiService();
}
