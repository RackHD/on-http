// Copyright 2014-2015, Renasar Technologies Inc.
// Created by heckj on 8/1/14.
/*jslint node: true */
'use strict';

var di = require('di'),
    _ = require('lodash'),
    express = require('express'),
    parser = require('body-parser'),
    router = express.Router();

router.use(parser.json());

module.exports = workflowsRouterFactory;

di.annotate(workflowsRouterFactory,
    new di.Inject(
        'Protocol.TaskGraphRunner',
        'common-api-presenter',
        'Logger',
        'Tracer'
    )
);

function workflowsRouterFactory (taskgraphRunner, presenter) {

    /**
     * @api {get} /api/common/workflows GET /
     * @apiDescription get list of active and past run workflow instances
     * @apiName workflows-get
     * @apiGroup workflows
     */

    router.get('/workflows/', presenter.middleware(function (req) {
        //TODO(heckj): verify that the filter object matches this
        // and that models are relevant here.
        var filter = _.merge(
            req.query || {}
        );
        return taskgraphRunner.getActiveTaskGraphs(filter);
    }));

    /**
     * @api {get} /api/common/workflows/library GET /library
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
     * @api {get} /api/common/workflows/library/:identifier GET /library/:identifier
     * @apiDescription get a specific workflow to run
     * @apiName workflows-library-item
     * @apiGroup workflows
     */

    router.get('/workflows/library/:identifier', presenter.middleware(function (req) {
        //TODO(heckj): verify format of filter for library call
        var filter = { id: req.param('identifier') };
        return taskgraphRunner.getTaskGraphLibrary(filter);
    }));

    /**
     * @api {get} /api/common/workflows/:identifier GET /:id
     * @apiDescription get a specific workflow
     * @apiName workflow-get
     * @apiGroup workflows
     * @apiParam {String} identifier of workflow, must cast to ObjectId
     */

    router.get('/workflows/:identifier', presenter.middleware(function (req) {
        var filter = { id: req.param('identifier') };
        return taskgraphRunner.getActiveTaskGraphs(filter);
    }));

    return router;
}
