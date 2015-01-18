// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node: true */
'use strict';

var di = require('di'),
    express = require('express'),
    parser = require('body-parser'),
    router = express.Router();


module.exports = tasksRouterFactory;

di.annotate(tasksRouterFactory,
    new di.Inject(
        'Protocol.TaskGraphRunner',
        'Services.Configuration',
        'Services.Waterline',
        'common-api-presenter',
        'Logger',
        'Tracer'
    )
);

function tasksRouterFactory (
    taskGraphService,
    configurationService,
    waterline,
    presenter,
    Logger
) {
    var logger = Logger.initialize(tasksRouterFactory);
    /*
     sets maximum data callback size for the payload of a set of tasks
     */
    //logger.info("Maximum task payload size of " + configurationService.get('maxTaskPayloadSize'));
    router.use(parser.json({limit: configurationService.get('maxTaskPayloadSize')}));

    router.get('/tasks/bootstrap.js', function (req, res) {
        waterline.nodes.findByIdentifier((req.param('macAddress') || '')
            .toLowerCase()).then(function (node) {
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
        .fail(function (err) {
                presenter(req, res).renderError(err);
        });
    });

    router.get('/tasks/:identifier', function (req, res, next) {
        //TODO(heckj): add these as protocol methods or replace the functionality...
        taskGraphService.requestTasks(req.param('identifier')).then(function (tasks) {
            res.json(tasks);
        })
        .fail(function (err) {
            logger.error('Error Getting Tasks.', {
                identifier: req.param('identifier'),
                error: err
            });

            next('route');
        });
    });

    router.post('/tasks/:identifier', function (req, res) {
        //TODO(heckj): add these as protocol methods or replace the functionality...
        taskGraphService.publishTasks(
            req.param('identifier'), req.body
        )
        .then(function() {
            res.status(201).end();
        })
        .fail(function(err) {
            logger.error('Error Publishing Tasks.', {
                identifier: req.param('identifier'),
                error: err
            });

            res.status(500).end();
        });
    });

    return router;
}
