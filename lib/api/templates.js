// Copyright 2014-2015, Renasar Technologies Inc.
/* jslint node: true */
'use strict';

var di = require('di'),
    express = require('express'),
    parser = require('body-parser'),
    router = express.Router();

module.exports = templatesRouterFactory;

di.annotate(templatesRouterFactory,
    new di.Inject(
		'Services.Waterline',
		'Services.Template',
		'Protocol.TaskGraphRunner',
		'Protocol.Task',
		'Services.Lookup',
		'Q',
		'common-api-presenter'
	)
);

function templatesRouterFactory (
    waterline,
    templateService,
    taskGraphProtocol,
    taskProtocol,
    lookupService,
    Q,
    presenter
) {
    var lookupMiddleware = lookupService.ipAddressToMacAddressMiddleware();
    router.get('/templates/library', lookupMiddleware, function (req, res) {
        presenter(req, res)
            .render(templateService.getAll());
    });

    router.get('/templates/library/:identifier', function (req, res) {
        presenter(req, res)
            .render(templateService.get(req.param('identifier')));
    });

    router.put('/templates/library/:identifier', parser.raw(),
               function (req, res) {
        templateService.put(req.param('identifier'), req.body.toString()).then(function () {
            res.status(200).send();
        }).catch(function (error) {
            res.status(500).json(error);
        });
    });

    router.get('/templates/:identifier', lookupMiddleware, function (req, res) {
        if (!req.macaddress) {
            return presenter(req, res)
                .renderError(new Error("Unable to look up the relevant node from " +
                    "the request, can't render template."));
        }
        waterline.nodes.findByIdentifier(req.macaddress).then(function (node) {
            if (node) {
                return taskGraphProtocol.getActiveTaskGraphs({ target: node.id})
                    .then(function(taskGraphInstance) {
                        if (taskGraphInstance) {
                            return taskProtocol.requestProperties(node.id);
                        } else {
                            return Q.reject(new Error("Unable to find active graph for node " +
                                node.id + " for properties request."));
                        }
                });
            } else {
                return Q.reject(new Error("Cannot render template for node with mac " +
                        req.macaddress + " because it does not exist in the database."));
            }
        })
        .then(function (properties) {
            presenter(req, res)
                .renderTemplate(
                    req.param('identifier'),
                    properties
                );
        })
        .catch(function (err) {
            presenter(req, res).renderError(err);
        });
    });

    return router;
}
