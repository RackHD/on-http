// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var catalogs = injector.get('Http.Services.Api.Catalogs');

/**
 * @api {get} /api/2.0/catalogs/ GET /
 * @apiDescription get list of catalogs or an empty list if no catalogs exist.
 * @apiName catalogs-get
 * @apiGroup catalogs
 */
var catalogsGet = controller(function(req) {
    return catalogs.getCatalog(req.query);
});

/**
 * @api {get} /api/2.0/catalogs/:identifier GET /:id
 * @apiDescription get specific catalog details
 * @apiName catalogs-get
 * @apiGroup catalogs
 */
var catalogsIdGet = controller(function(req) {
    return catalogs.getCatalogById(req.swagger.params.identifier.value);
});

module.exports = {
    catalogsGet: catalogsGet,
    catalogsIdGet: catalogsIdGet
};

