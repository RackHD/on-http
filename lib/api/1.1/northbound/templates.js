// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di');
var express = require('express');

module.exports = templatesRouterFactory;

di.annotate(templatesRouterFactory, new di.Provide('Http.Api.Templates'));
di.annotate(templatesRouterFactory,
    new di.Inject(
		'Templates',
		'common-api-presenter',
        'Promise'
	)
);

function templatesRouterFactory (
    templates,
    presenter,
    Promise
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
        Promise.map(templates.getAll(), function(t) {
            return templates.get(t.name, t.scope);
        })
        .then(function(t) {
            presenter(req, res).render(t);
        });
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
            .render(templates.get(req.params.identifier, req.query.scope));
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

    router.put('/templates/library/:identifier', function(req, res) {
        return templates.put(req.params.identifier, req)
        .then(function(template) {
            res.status(200).json(template);
        })
        .catch(function(err) {
            res.status(500).json(err);
        });
    });

    return router;
}
