// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    express = require('express'),
    parser = require('body-parser');

module.exports = templatesRouterFactory;

di.annotate(templatesRouterFactory, new di.Provide('Http.Api.Internal.Templates'));
di.annotate(templatesRouterFactory,
    new di.Inject(
		'Services.Waterline',
		'Protocol.TaskGraphRunner',
		'Protocol.Task',
		'Services.Lookup',
		'Promise',
		'common-api-presenter'
	)
);

function templatesRouterFactory (
    waterline,
    taskGraphProtocol,
    taskProtocol,
    lookupService,
    Promise,
    presenter
) {
    var router = express.Router();

    /**
     * @api {get} /api/1.1/templates/:identifier GET /:identifier
     * @apiVersion 1.1.0
     * @apiDescription used internally by the system -- will NOT the template with the
     *                                  <code>identifier</code>, use /api/current/templates/library
     * @apiName template-get
     * @apiGroup templates
     */

    router.get('/templates/:identifier',
               lookupService.ipAddressToMacAddressMiddleware(),
               function (req, res) {
        if (!req.macaddress) {
            return presenter(req, res)
                .renderError(new Error("Unable to look up the relevant node from " +
                    "the request, can't render template."));
        }
        waterline.nodes.findByIdentifier(req.macaddress).then(function (node) {
            if (node) {
                return taskGraphProtocol.getActiveTaskGraph({ target: node.id})
                    .then(function(taskGraphInstance) {
                        if (taskGraphInstance) {
                            return taskProtocol.requestProperties(node.id);
                        } else {
                            return Promise.reject(
                                new Error("Unable to find active graph for node " +
                                node.id + " for properties request."));
                        }
                });
            } else {
                return Promise.reject(new Error("Cannot render template for node with mac " +
                        req.macaddress + " because it does not exist in the database."));
            }
        })
        .then(function (properties) {
            presenter(req, res)
                .renderTemplate(
                    req.params.identifier,
                    properties
                );
        })
        .catch(function (err) {
            presenter(req, res).renderError(err);
        });
    });

    return router;
}
