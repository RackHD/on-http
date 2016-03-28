// Copyright 2016, EMC Inc.

'use strict';

var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var workflowApiService = injector.get('Http.Services.Api.Workflows');
var _ = require('lodash');    // jshint ignore:line

/**
* @api {get} /api/2.0/workflows GET /workflows
* @apiVersion 2.0.0
* @apiDescription Get list of active and past run workflow instances
* @apiName workflows-get
* @apiGroup workflows
* @apiSuccess {json} List of all workflows or if there are none an empty object.
*/

var workflowsGet = controller(function(req) {
    return workflowApiService.getActiveWorkflows(req.query)
    .then(function(workflows) {
        if (req.swagger.query && _(req.swagger.query).has('active')) {
            return _(workflows)
            .filter(function(workflow) {
                return workflow.active() === req.swagger.query.active;
            });
        }
        return workflows;
    });
});

/**
* @api {post} /api/2.0/workflows POST /workflows
* @apiVersion 2.0.0
* @apiDescription Run a new workflow
* @apiName workflows-run
* @apiGroup workflows
* @apiError Error problem was encountered, workflow was not run.
*/

var workflowsPost = controller({success: 201}, function(req) {
    var configuration = _.defaults(req.query || {}, req.body || {});
    return workflowApiService.createAndRunGraph(configuration);
});

/**
* @api {get} /api/2.0/workflows/:identifier GET /workflows/:identifier
* @apiVersion 2.0.0
* @apiDescription get a specific workflow
* @apiName workflows-getById
* @apiGroup workflows
* @apiParam {String} instanceId of workflow
* @apiSuccess {json} workflows of the particular identifier or if there are none an empty object.
* @apiError NotFound There is no workflow with <code>instanceId</code>
*/

var workflowsGetById = controller(function(req) {
    return workflowApiService.getWorkflowById(req.swagger.params.identifier.value);
});

/**
* @api {put} /api/2.0/workflows/:identifier PUT /workflows/:identifier/cancel
* @apiVersion 2.0.0
* @apiDescription cancel the specified workflow
* @apiName workflows-cancel
* @apiGroup workflows
* @apiParam {String} instanceId of workflow
* @apiSuccess {json}  object.
* @apiError NotFound There is no workflow with <code>instanceId</code>
*/

var workflowsCancel = controller(function(req) {
    return workflowApiService.cancelTaskGraph(req.swagger.params.identifier.value);
});

/**
* @api {delete} /api/2.0/workflows/:identifier DELETE /workflows/:identifier
* @apiVersion 2.0.0
* @apiDescription Cancel currently running workflows for specified node
* @apiName workflows-DeleteById
* @apiGroup workflows
* @apiParam {String} instanceId of workflow
* @apiSuccess {json}  object.
* @apiError NotFound The node with the identifier was not found <code>instanceId</code>
*/

var workflowsDeleteById = controller(function(req) {
    return workflowApiService.deleteTaskGraph(req.swagger.params.identifier.value);
});

module.exports = {
    workflowsGet: workflowsGet,
    workflowsPost: workflowsPost,
    workflowsGetById: workflowsGetById,
    workflowsDeleteById: workflowsDeleteById,
    workflowsCancel: workflowsCancel
};
