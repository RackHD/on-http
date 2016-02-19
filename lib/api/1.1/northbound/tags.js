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

    /**
     * @api {get} /api/1.1/tags GET /
     * @apiVersion 1.1.0
     * @apiDescription Retrieve a list of tags with rules
     * @apiName get-tags
     * @apiGroup tags
     * @apiSuccess (Success 200) {json} The list of tags
     */
    router.get('/tags', rest(function (req) {
        return Tags.findTags(req.query);
    }));

    /**
     * @api {get} /api/1.1/tags/:name GET /:name
     * @apiVersion 1.1.0
     * @apiDescription Retrieve information about a tag with rules
     * @apiName get-tags-named
     * @apiGroup tags
     * @apiParam {String} Name of tag
     * @apiSuccess (Success 200) {json} Information about the tag name
     * @apiError NotFound The tag with the <code>name</code> was not found.
     */
    router.get('/tags/:name', rest(function (req) {
        return Tags.getTag(req.params.identifier);
    }));

    /**
     * @api {post} /api/1.1/tags POST /
     * @apiVersion 1.1.0
     * @apiDescription Create a tag with rules
     * @apiName post-tags
     * @apiGroup tags
     * @apiSuccess (Success 200) {json} Information about the tag created
     */
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

    /**
     * @api {delete} /api/1.1/tags/:name DELETE /:name
     * @apiVersion 1.1.0
     * @apiDescription Delete the tag named
     * @apiName delete-tags-named
     * @apiGroup tags
     * @apiParam {String} Name of tag
     * @apiSuccess (Success 204) Empty
     */
    router.delete('/tags/:name', rest(function(req) {
        return Tags.destroyTag(req.params.identifier);
    }, { renderOptions: {success: 204} }));

    /**
     * @api {get} /api/1.1/tags/:name/nodes GET /:name/nodes
     * @apiVersion 1.1.0
     * @apiDescription Retrieve a list of nodes with the specified tag
     * @apiName get-nodes-with-tag
     * @apiGroup tags
     * @apiParam {String} Name of tag
     * @apiSuccess (Success 200) {json} List of nodes
     */
    router.get('/tags/:name/nodes', rest(function (req) {
        return Nodes.getNodesByTag(req.params.name);
    }));

    /**
     * @api {post} /api/1.1/tags/:name/nodes/workflows POST /:name/nodes/workflows
     * @apiVersion 1.1.0
     * @apiDescription Initiate a workflow on the nodes with the specified tag
     * @apiName post-workflow-to-nodes-with-tag
     * @apiGroup tags
     * @apiParam {String} Name of tag
     * @apiSuccess (Success 200) {json} List of workflow status
     */
    router.post('/tags/:name/nodes/workflows', rest(function(req) {
        return Promise.map(Nodes.getNodesByTag(req.params.name), function(node) {
            return Nodes.setNodeWorkflow(node.id, req.query.name, req.body.options);
        });
    }, { renderOptions: { success: 202 } }));

    return router;
}
