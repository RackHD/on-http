// Copyright 2014, Renasar Technologies Inc.
/* jslint node: true */
'use strict';

var di = require('di'),
    express = require('express'),
    parser = require('body-parser'),
    router = express.Router();

router.use(parser.json());

module.exports = templatesRouterFactory;

di.annotate(templatesRouterFactory,
    new di.Inject(
		'Services.Waterline',
		'template-service',
		'workflow-manager',
		'Services.Lookup',
		'Q',
		'common-api-presenter'
	)
);

function templatesRouterFactory (
    waterline,
    templateService,
    workflowService,
    lookupService,
    Q,
    presenter
) {
	router.use(lookupService.ipAddressToMacAddressMiddleware());

    router.get('/templates/library', function (req, res) {
        presenter(req, res)
            .render(templateService.getAll());
    });

    router.get('/templates/:identifier', function (req, res) {
        if (!req.macaddress) {
            return presenter(req, res)
                .renderError(new Error("Unable to look up the relevant node from " +
                    "the request, can't render template."));
        }
        waterline.nodes.findByIdentifier(req.macaddress).then(function (node) {
            if (node) {
                return workflowService.requestProperties(node.id);
            } else {
                return Q.reject(new Error("Unable to find node for properties request."));
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
