// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di');

module.exports = catalogApiServiceFactory;
di.annotate(catalogApiServiceFactory, new di.Provide('Http.Services.Api.Catalogs'));
di.annotate(catalogApiServiceFactory,
    new di.Inject(
        'Services.Waterline',
        '_'
    )
);
function catalogApiServiceFactory(
    waterline,
    _
) {

    function CatalogApiService() {
    }

    /**
     * Get list of catalogs
     * @param {Object} [req] HTTP request
     * @return {Promise}
     */
    CatalogApiService.prototype.getCatalog = function(req) {
        return waterline.catalogs.find(req);
    };

    /**
     * Get specific catalog details
     * @param {Object} [req] HTTP request
     * @return {Promise}
     */
    CatalogApiService.prototype.getCatalogById = function(req) {
        return waterline.catalogs.needByIdentifier(req);
    };

    return new CatalogApiService();
}
