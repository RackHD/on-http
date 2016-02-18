// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;

module.exports = {
    getObmLib: getObmLib,
    getObmLibById: getObmLibById
};

/**
 * @api {get} /api/2.0/obms/library GET /library
 * @apiVersion 2.0.0
 * @apiDescription get list of possible OBM services
 * @apiName obms-library-get
 * @apiGroup obms
 * @apiSuccess {json} obms list of the available obms.
 */
function getObmLib(req, res) {
    var obm = injector.get('Http.Services.Api.Obms');
    res.json(obm.getObmLib());
}

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
function getObmLibById(req, res) {
    var obm = injector.get('Http.Services.Api.Obms');
    //res.json(config.configSet(req));
    res.json(obm.getObmLibById(req.swagger.params.identifier.value));
}

