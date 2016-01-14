// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    express = require('express'),
    parser = require('body-parser');

module.exports = templatesRouterFactory;

di.annotate(templatesRouterFactory, new di.Provide('Http.Api.Templates'));
di.annotate(templatesRouterFactory,
    new di.Inject(
		'Services.Waterline',
		'Templates',
		'Protocol.TaskGraphRunner',
		'Protocol.Task',
		'Services.Lookup',
		'Promise',
		'common-api-presenter'
	)
);

function templatesRouterFactory (
    waterline,
    templates,
    taskGraphProtocol,
    taskProtocol,
    lookupService,
    Promise,
    presenter
) {
    var router = express.Router();

    /**
     * @api {get} /api/1.1/templates/library GET /library
     * @apiVersion 1.1.0
     * @apiDescription get list of possible templates
     * @apiName templates-library-get
     * @apiGroup templates
     * @apiSuccess {json} templates list of the available library.
     */

    router.get('/templates/library', function (req, res) {
        presenter(req, res)
            .render(templates.getAll());
    });


    /**
     * @api {get} /api/1.1/templates/library/:identifier GET /library/:identifier
     * @apiVersion 1.1.0
     * @apiDescription get a single templates
     * @apiName template-library-service-get
     * @apiGroup templates
     * @apiParam {String} identifier String representation of the ObjectId
     * @apiParamExample {String} Identifier-Example:
     *      "ansible-external-inventory.js"
     * @apiError NotFound There is no templates in the library with <code>identifier</code>
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *     }
     */

    router.get('/templates/library/:identifier', function (req, res) {
        presenter(req, res)
            .render(templates.get(req.params.identifier));
    });


    /**
     * @api {put} /api/1.1/templates/library PUT
     * @apiVersion 1.1.0
     * @apiDescription put a single templates
     * @apiName template-library-service-put
     * @apiGroup templates
     * @apiError Error problem was encountered, template was not written.
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 500 Error
     *     {
     *       "error": "upload failed."
     *     }
     */

    router.put('/templates/library/:identifier', parser.raw(),
               function (req, res) {
        templates.put(req.params.identifier, req.body.toString()).then(function () {
            res.status(200).send();
        }).catch(function (error) {
            res.status(500).json(error);
        });
    });


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
