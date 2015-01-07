// Copyright 2014, Renasar Technologies Inc.
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
        'waterline-service',
        'workflow-manager',
        'common-api-presenter'
    )
);

function workflowsRouterFactory (waterline, workflowService, presenter) {

    /**
     * @api {get} /api/common/workflows GET /
     * @apiDescription get list of active and past run workflow instances
     * @apiName workflows-get
     * @apiGroup workflows
     */

    router.get('/workflows/', presenter.middleware(function (req) {
        return waterline.workflows.find(
            _.merge(
                req.query || {},
                { where: { type: 'parentWorkflow'} }
            )
        ).populate('workflows');
    }));

    /**
     * @api {get} /api/common/workflows/library GET /library
     * @apiDescription get list of workflows possible to run
     * @apiName workflows-library
     * @apiGroup workflows
     */

    router.get('/workflows/library', presenter.middleware(function () {
        return workflowService.getLibrary();
    }));

    /**
     * @api {get} /api/common/workflows/library/:identifier GET /library/:identifier
     * @apiDescription get a specific workflow to run
     * @apiName workflows-library-item
     * @apiGroup workflows
     */

    router.get('/workflows/library/:identifier', presenter.middleware(function (req) {
        return workflowService.getLibraryWorkflow(req.param('identifier'));
    }));

    /**
     * @api {get} /api/common/workflows/:identifier GET /:id
     * @apiDescription get a specific workflow
     * @apiName workflow-get
     * @apiGroup workflows
     * @apiParam {String} identifier of workflow, must cast to ObjectId
     */

    router.get('/workflows/:identifier', presenter.middleware(function (req) {
        return waterline.workflows.findOne({ id: req.param('identifier') }).populate('workflows');
    }));

    /**
     * @api {get} /api/common/workflows/:identifier/events GET /:id/events
     * @apiDescription get events for specific workflow
     * @apiName workflow-get-events
     * @apiGroup workflows
     * @apiParam {String} identifier of workflow, must cast to ObjectId
     */

    router.get('/workflows/:identifier/events', presenter.middleware(function (req) {
        return waterline.workflowevents.find(
            _.merge(
                req.query || { sort: { createdAt: 1 } },
                { where: { workflow: req.param('identifier') } }
            )
        );
    }));

    return router;
}
