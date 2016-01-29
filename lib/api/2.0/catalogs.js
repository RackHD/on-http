// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;

module.exports = {
    getCatalog: getCatalog,
    getCatalogById: getCatalogById


};
/**
 * @api {get} /api/2.0/catalogs/ GET /
 * @apiDescription get list of catalogs or an empty list if no catalogs exist.
 * @apiName catalogs-get
 * @apiGroup catalogs
 */
function getCatalog(req, res) {
    var catalogs = injector.get('Http.Services.Api.Catalogs');
    catalogs.getCatalog(req.query).then(function(catalog) {
        res.json(catalog);
    }).catch(function(e) {
        res.status(500).json({
            error: 'Failed to GET catalog info:' + e.message
        });
    });
}
/**
 * @api {get} /api/2.0/catalogs/:identifier GET /:id
 * @apiDescription get specific catalog details
 * @apiName catalogs-get
 * @apiGroup catalogs
 */
function getCatalogById(req, res) {
    var catalogs = injector.get('Http.Services.Api.Catalogs');
    catalogs.getCatalogById(req.swagger.params.identifier.value).then(function(catalog) {
        res.json(catalog);
    }).catch(function(e) {
        res.status(500).json({
            error: 'Failed to GET specific catalog info:' + e.message
        });
    });
}
