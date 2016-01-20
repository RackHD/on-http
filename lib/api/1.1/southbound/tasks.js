// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    express = require('express'),
    parser = require('body-parser');

module.exports = tasksRouterFactory;

di.annotate(tasksRouterFactory, new di.Provide('Http.Api.Tasks'));
di.annotate(tasksRouterFactory,
    new di.Inject(
        'Http.Services.Api.Tasks',
        'Protocol.Task',
        'Services.Configuration',
        'common-api-presenter',
        'Logger'
    )
);

function tasksRouterFactory (
    tasksApiService,
    taskProtocol,
    configurationService,
    presenter,
    Logger
) {
    var router = express.Router();
    var logger = Logger.initialize(tasksRouterFactory);
    /*
     sets maximum data callback size for the payload of a set of tasks
     */
    var parserMiddleware = parser.json({
        limit: configurationService.get('maxTaskPayloadSize', '10mb')
    });

    /**
     * @api {get} /api/1.1/tasks/bootstrap.js GET
     * @apiVersion 1.1.0
     * @apiDescription used internally by the system - get tasks bootstrap.js
     * @apiName tasks-bootstrap-get
     * @apiGroup tasks
     * @apiError NotFound There is no bootstrap.js
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *     }
     */

    router.get('/tasks/bootstrap.js', function (req, res) {
        tasksApiService.getNode(req.query.macAddress)
            .then(function (node) {
                if (node) {
                    presenter(req, res)
                        .renderTemplate(
                            'bootstrap.js',
                            {
                                identifier: node.id
                            }
                        );
                } else {
                    presenter(req, res).renderNotFound();
                }
        })
        .catch(function (err) {
                presenter(req, res).renderError(err);
        });
    });

    /**
     * @api {get} /api/1.1/tasks/:identifier GET /:id
     * @apiVersion 1.1.0
     * @apiDescription used internally by the system - get specific task
     * @apiName task-get
     * @apiGroup tasks
     * @apiParam {String} identifier of tasks, must cast to ObjectId
     * @apiError NotFound There is no tasks with the <code>identifier</code>
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *     }
     */

    router.get('/tasks/:identifier', function (req, res, next) {
        tasksApiService.getTasks(req.params.identifier)
        .then(function (tasks) {
            res.json(tasks);
        })
        .catch(function (err) {
            if (err.name === 'NoActiveTaskError') {
                res.status(204).end();
                return;
            }

            logger.error('Error Getting Tasks.', {
                identifier: req.params.identifier,
                error: err
            });

            next('route');
        });
    });

    /**
     * @api {post} /api/1.1/tasks/:identifier POST /:id
     * @apiVersion 1.1.0
     * @apiDescription used internally by the system - post specific task
     * @apiName task-post
     * @apiGroup tasks
     * @apiParam {String} identifier of tasks, must cast to ObjectId
     * @apiError NotFound There is no tasks with the <code>identifier</code>
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *     }
     */

    router.post('/tasks/:identifier', parserMiddleware, function (req, res) {
        taskProtocol.respondCommands(req.params.identifier, req.body);
        res.status(201).end();
    });

    return router;
}
