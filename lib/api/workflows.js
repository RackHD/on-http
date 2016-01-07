// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    express = require('express');

module.exports = workflowsRouterFactory;

di.annotate(workflowsRouterFactory, new di.Provide('Http.Api.Workflows'));
di.annotate(workflowsRouterFactory,
    new di.Inject(
        'Protocol.TaskGraphRunner',
        'Http.Services.RestApi',
        'Services.Waterline',
        '_'
    )
);

function workflowsRouterFactory (taskgraphRunner, rest, waterline, _) {
    var router = express.Router();

    /**
     * @api {get} /api/1.1/workflows GET /
     * @apiVersion 1.1.0
     * @apiDescription get list of active and past run workflow instances
     * or an empty object if there are none
     * @apiName workflows-get
     * @apiGroup workflows
     * @apiSuccess {json} workflows List of all workflows or if there are none an empty object.
     */

    router.get('/workflows/', rest(function (req) {
        return waterline.graphobjects.find(req.query);
    }));

    /**
     * @api {put} /api/1.1/workflows PUT /
     * @apiVersion 1.1.0
     * @apiDescription define a new workflow
     * @apiName workflows-define
     * @apiGroup workflows
     * @apiError Error problem was encountered, workflow was not written.
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 500 Error
     *     {
     *       "error": "upload failed."
     *     }
     */

    router.put('/workflows/', rest(function (req) {
        return taskgraphRunner.defineTaskGraph(req.body);
    }));

    /**
     * @api {put} /api/1.1/workflows/tasks PUT /tasks
     * @apiVersion 1.1.0
     * @apiDescription add a task to the tasks library
     * @apiName workflowTasks-define
     * @apiGroup workflowTasks
     * @apiParam {json} task The task to be added to the library
     * @apiSuccess {string} injectableName The value of the injectableName of the task
     */

    router.put('/workflows/tasks', rest(function (req) {
        return taskgraphRunner.defineTask(req.body);
    }));


    /**
     * @api {get} /api/1.1/workflows/tasks/library GET /tasks/library
     * @apiVersion 1.1.0
     * @apiDescription get list of tasks possible to run in workflows
     * @apiName tasks-library
     * @apiSuccess {json} tasks List of all tasks possible to run in workflows.
     * @apiGroup workflowTasks
     */

    router.get('/workflows/tasks/library', rest(function (req) {
        //TODO(heckj): verify that the filter object matches this
        // and that models are relevant here.
        var filter = _.merge(
            req.query || {}
        );
        return taskgraphRunner.getTaskLibrary(filter);
    }));

    /**
     * @api {get} /api/1.1/workflows/library GET /library
     * @apiVersion 1.1.0
     * @apiDescription get list of workflows possible to run
     * @apiName workflows-library
     * @apiSuccess {json} workflows list of workflows that are possible to run
     * @apiGroup workflows
     */

    router.get('/workflows/library', rest(function () {
        //TODO(heckj): library function on protocol takes a filter,
        // check to see what options are supported, and if this should pass any
        return taskgraphRunner.getTaskGraphLibrary();
    }));

    /**
     * @api {get} /api/1.1/workflows/library/:identifier GET /library/:identifier
     * @apiVersion 1.1.0
     * @apiDescription get a specific workflow from the library
     * @apiParam {String} identifier of workflow, must cast to ObjectId
     * @apiName workflows-library-item
     * @apiSuccess {json} workflow the workflow that have the <code>identifier</code>
     * @apiGroup workflows
     */

    router.get('/workflows/library/:identifier', rest(function (req) {
        //TODO(heckj): verify format of filter for library call
        var filter = { injectableName: req.params.identifier };
        return taskgraphRunner.getTaskGraphLibrary(filter);
    }));

    /**
     * @api {get} /api/1.1/workflows/:identifier GET /:id
     * @apiVersion 1.1.0
     * @apiDescription get a specific workflow
     * @apiName workflow-get
     * @apiGroup workflows
     * @apiParam {String} identifier of workflow, must cast to ObjectId
     * @apiSuccess {json} workflow the workflow that have the <code>identifier</code>
     * @apiError NotFound There is no workflow with <code>identifier</code>
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *     }
     */

    router.get('/workflows/:identifier', rest(function (req) {
        return waterline.graphobjects.needByIdentifier(req.params.identifier);
    }));

    return router;
}
