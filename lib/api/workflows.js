// Copyright 2014-2015, Renasar Technologies Inc.
// Created by heckj on 8/1/14.
/*jslint node: true */
'use strict';

var di = require('di'),
    express = require('express'),
    parser = require('body-parser');

module.exports = workflowsRouterFactory;

di.annotate(workflowsRouterFactory, new di.Provide('Http.Api.Workflows'));
di.annotate(workflowsRouterFactory,
    new di.Inject(
        'Protocol.TaskGraphRunner',
        'common-api-presenter',
        'Services.Waterline',
        '_'
    )
);

function workflowsRouterFactory (taskgraphRunner, presenter, waterline, _) {
    var router = express.Router();

    /**
     * @api {get} /api/1.1/workflows GET /
     * @apiVersion 1.1.0
     * @apiDescription get list of active and past run workflow instances or an empty object if there are none
     * @apiName workflows-get
     * @apiGroup workflows
     */

    router.get('/workflows/', presenter.middleware(function (req) {
        return waterline.graphobjects.find(req.query);
    }));

    /**
     * @api {get} /api/1.1/workflows PUT /
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

    router.put('/workflows/', parser.json(), presenter.middleware(function (req) {
        return taskgraphRunner.defineTaskGraph(req.body);
    }));

    /**
     * @api {get} /api/1.1/workflows/tasks PUT /tasks
     * @apiVersion 1.1.0
     * @apiDescription add a task to the tasks library
     * @apiName workflowTasks-define
     * @apiGroup workflowTasks
     */

    router.put('/workflows/tasks', parser.json(), presenter.middleware(function (req) {
        return taskgraphRunner.defineTask(req.body);
    }));


    /**
     * @api {get} /api/1.1/workflows/tasks/library GET /tasks/library
     * @apiVersion 1.1.0
     * @apiDescription get list of tasks possible to run in workflows
     * @apiName tasks-library
     * @apiGroup workflowTasks
     */

    router.get('/workflows/tasks/library', presenter.middleware(function (req) {
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
     * @apiGroup workflows
     */

    router.get('/workflows/library', presenter.middleware(function () {
        //TODO(heckj): library function on protocol takes a filter,
        // check to see what options are supported, and if this should pass any
        return taskgraphRunner.getTaskGraphLibrary();
    }));

    /**
     * @api {get} /api/1.1/workflows/library/:identifier GET /library/:identifier
     * @apiVersion 1.1.0
     * @apiDescription get a specific workflow from the library
     * @apiName workflows-library-item
     * @apiGroup workflows
     */

    router.get('/workflows/library/:identifier', presenter.middleware(function (req) {
        //TODO(heckj): verify format of filter for library call
        var filter = { id: req.params.identifier };
        return taskgraphRunner.getTaskGraphLibrary(filter);
    }));

    /**
     * @api {get} /api/1.1/workflows/:identifier GET /:id
     * @apiVersion 1.1.0
     * @apiDescription get a specific workflow
     * @apiName workflow-get
     * @apiGroup workflows
     * @apiParam {String} identifier of workflow, must cast to ObjectId
     * @apiError NotFound There is no workflow with <code>identifier</code>
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *     }
     */

    router.get('/workflows/:identifier', presenter.middleware(function (req) {
        return waterline.graphobjects.findByIdentifier(req.params.identifier);
    }));

    return router;
}
