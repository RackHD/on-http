// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var obms = injector.get('Http.Services.Api.Obms');


/**
 * @api {get} /api/2.0/obms/library GET /library
 * @apiVersion 2.0.0
 * @apiDescription get list of possible OBM services
 * @apiName obms-library-get
 * @apiGroup obms
 * @apiSuccess {json} obms list of the available obms.
 */
var getObmLib = controller(function() {
    return obms.getObmLib();
});
/**
 * @api {get} /api/2.0/obms/library/:identifier GET /library/:identifier
 * @apiVersion 2.0.0
 * @apiDescription get a single OBM service
 * @apiName obms-library-service-get
 * @apiGroup obms
 * @apiParam {String} identifier The obm service name.
 * @apiParamExample {String }Identifier-Example:
 *      "amt-obm-service"
 */
var getObmLibById = controller(function(req) {
    return obms.getObmLibById(req.swagger.params.identifier.value);
});

module.exports = {
    getObmLib: getObmLib,
    getObmLibById: getObmLibById
};
