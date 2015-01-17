// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node: true */
'use strict';

var di = require('di'),
    express = require('express'),
    parser = require('body-parser'),
    router = express.Router();

router.use(parser.json());

module.exports = catalogsRouterFactory;

di.annotate(catalogsRouterFactory, new di.Inject(
        'Logger',
        'common-api-presenter',
        'Services.Waterline'
    )
);

function catalogsRouterFactory (logger, presenter, waterline) {

    /**
     * @api {get} /api/common/catalogs/ GET /
     * @apiDescription get list of catalogs
     * @apiName catalogs-get
     * @apiGroup catalogs
     */

    router.get('/catalogs', presenter.middleware(function (req) {
        return waterline.catalogs.find(req.query);
    }));

    /**
     * @api {get} /api/common/catalogs/:identifier GET /:id
     * @apiDescription get specific catalog details
     * @apiName catalog-get
     * @apiGroup catalogs
     * @apiParam {String} identifier of catalog, must cast to ObjectId
     */

    router.get('/catalogs/:identifier', presenter.middleware(function (req) {
        return waterline.catalogs.findByIdentifier(req.param('identifier'));
    }));

    return router;
}
