// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    express = require('express');

module.exports = catalogsRouterFactory;

di.annotate(catalogsRouterFactory, new di.Provide('Http.Api.Catalogs'));
di.annotate(catalogsRouterFactory, new di.Inject(
        'Services.Waterline',
        'Http.Services.RestApi'
    )
);

function catalogsRouterFactory (waterline, rest) {
    var router = express.Router();

    /**
     * @api {get} /api/1.1/catalogs/ GET /
     * @apiDescription get list of catalogs
     * @apiVersion 1.1.0
     * @apiDescription get list of catalogs or an empty list if no catalogs exist.
     * @apiName catalogs-get
     * @apiGroup catalogs
     */

    router.get('/catalogs', rest(function (req) {
        return waterline.catalogs.find(req.query);
    }));

    /**
     * @api {get} /api/1.1/catalogs/:identifier GET /:id
     * @apiVersion 1.1.0
     * @apiDescription get specific catalog details
     * @apiName catalog-get
     * @apiGroup catalogs
     * @apiParam {String} identifier of catalog, must cast to ObjectId
     * @apiError NotFound The catalog with the <code>id</code> was not found.
     * @apiErrorExample {json} Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *      }
     */

    router.get('/catalogs/:identifier', rest(function (req) {
        return waterline.catalogs.needByIdentifier(req.params.identifier);
    }));

    return router;
}
