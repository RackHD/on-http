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
        'Promise',
        'Errors'
    )
);

function tagsRouterFactory (
    Tags,
    Nodes, 
    rest, 
    _, 
    Promise,
    Errors
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
        return Tags.getTag(req.params.name);
    }));

    /**
     * @api {post} /api/1.1/tags POST /
     * @apiVersion 1.1.0
     * @apiDescription Create a tag with rules
     * @apiName post-tags
     * @apiGroup tags
     * @apiSuccess (Success 201) {json} Information about the tag created
     */
    router.post('/tags', parser.json(), rest(function (req) {
        return Tags.findTags({name: req.body.name})
            .then(function(tag) {
                if(_.isEmpty(tag)) {
                    return Tags.createTag(req.body)
                    .then(function() {
                        return Tags.regenerateTags();
                    });
                } else {
                    // TODO: Replace with HttpError after errors are refactored
                    var err = new Errors.BaseError('tag name already exists');
                    err.status = 409;
                    throw err;
                }
            })
            .then(function() {
                return Tags.getTag(req.body.name);
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
        return Tags.destroyTag(req.params.name);
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
            return Nodes.setNodeWorkflow({
                name: req.query.name,
                options: req.body.options
            }, node.id);
        });
    }, { renderOptions: { success: 202 } }));

    return router;
}
