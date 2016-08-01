// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    express = require('express');

module.exports = templatesRouterFactory;

di.annotate(templatesRouterFactory, new di.Provide('Http.Api.Internal.Templates'));
di.annotate(templatesRouterFactory,
    new di.Inject(
	    'Services.Waterline',
	    'Http.Services.Api.Workflows',
	    'Protocol.Task',
	    'Services.Lookup',
	    'Promise',
	    'common-api-presenter'
	)
);

function templatesRouterFactory (
    waterline,
    workflowApiService,
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
                return workflowApiService.findActiveGraphForTarget(node.id)
                    .then(function(taskGraphInstance) {
                        if (taskGraphInstance) {
                            return Promise.props({
                                options: taskProtocol.requestProperties(node.id),
                                context: taskGraphInstance.context
                            });
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
                    properties.options,
                    200,
                    properties.context
                );
        })
        .catch(function (err) {
            presenter(req, res).renderError(err);
        });
    });

    return router;
}
