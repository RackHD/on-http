// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di');

module.exports = catalogApiServiceFactory;
di.annotate(catalogApiServiceFactory, new di.Provide('Http.Services.Api.Catalogs'));
di.annotate(catalogApiServiceFactory,
    new di.Inject(
        'Services.Waterline'
    )
);
function catalogApiServiceFactory(
    waterline
) {

    function CatalogApiService() {
    }

    /**
     * Get list of catalogs
     * @param {Object} query [req.query] HTTP request
     * @return {Promise}
     */
    CatalogApiService.prototype.getCatalog = function(query) {
        return waterline.catalogs.findMongo(query);
    };

    /**
     * Get specific catalog details
     * @param identifier [req.params.identifier] HTTP request
     * @return {Promise}
     */
    CatalogApiService.prototype.getCatalogById = function(id) {
        return waterline.catalogs.needByIdentifier(id);
    };


    /**
     *  Get specific firmware catalog details
     * @param identifier [req.params.identifier] HTTP request
     * @return {Promise}
     */
    CatalogApiService.prototype.getFirmwareCatalogById = function(id) {
           return waterline.firmware.find({nodeId:id}) ;
    };

    
    return new CatalogApiService();
}
