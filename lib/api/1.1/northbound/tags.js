// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    express = require('express'),
    parser = require('body-parser');

module.exports = tagsRouterFactory;

di.annotate(tagsRouterFactory, new di.Provide('Http.Api.Tags'));
di.annotate(tagsRouterFactory, new di.Inject(
        'Http.Services.Api.Tags',
        'Http.Services.Api.Nodes',
        'Http.Services.RestApi',
        '_',
        'Promise'
    )
);

function tagsRouterFactory (
    Tags,
    Nodes, 
    rest, 
    _, 
    Promise
) {
    var router = express.Router();

    router.get('/tags', rest(function (req) {
        return Tags.findTags(req.query);
    }));

    router.get('/tags/:name', rest(function (req) {
        return Tags.getTag(req.params.identifier);
    }));

    router.post('/tags', parser.json(), rest(function (req) {
        return Tags.findTags({name: req.body.name})
            .then(function(tag) {
                if(_.isEmpty(tag)) {
                    return Tags.createTag(req.body)
                        .then(function() {
                            return Tags.regenerateTags();
                        });
                }
            })
            .then(function() {
                return req.body;
            });
    }, { renderOptions: { success: 201 } }));


    router.delete('/tags/:name', rest(function(req) {
        return Tags.destroyTag(req.params.identifier);
    }, { renderOptions: {success: 204} }));

    router.get('/tags/:name/nodes', rest(function (req) {
        return Nodes.getNodesByTag(req.params.name);
    }));

    router.post('/tags/:name/nodes/workflows', rest(function(req) {
        return Promise.map(Nodes.getNodesByTag(req.params.name), function(node) {
            return Nodes.setNodeWorkflow(node.id, req.query.name, req.body.options);
        });
    }, { renderOptions: { success: 202 } }));

    return router;
}
