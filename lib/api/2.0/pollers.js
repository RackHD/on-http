// Copyright 2016, EMC Inc.

'use strict';

var injector = require('../../../index').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var pollers = injector.get('Http.Services.Api.Pollers');


/**
 * @api {get} /api/2.0/pollers/library GET /library
 * @apiVersion 2.0.0
 * @apiDescription get list of possible pollers services
 * @apiName pollers-library-get
 * @apiGroup pollers
 * @apiSuccess {json} pollers list of the available library pollers.
 */
var pollersLibGet = controller(function() {
    return pollers.getPollerLib();
});

/**
 * @api {get} /api/2.0/pollers/library/:identifier GET /library/:identifier
 * @apiVersion 2.0.0
 * @apiDescription get a single poller
 * @apiName pollers-library-service-get
 * @apiGroup pollers
 * @apiParam {String} identifier String representation of the ObjectId
 * @apiParamExample {String} Identifier-Example:
 *      "ipmi"
 * @apiSuccess {json} poller the specfied poller library
 * @apiError NotFound There is no poller in the library with <code>identifier</code>
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 404 Not Found
 *     {
 *       "error": "Not Found"
 *     }
 */
var pollersLibByIdGet = controller(function(req) {
    return pollers.getPollerLibById(req.swagger.params.identifier.value);
});

/**
 * @api {get} /api/2.0/pollers GET /
 * @apiVersion 2.0.0
 * @apiDescription get a list of all pollers
 * @apiName pollers-get
 * @apiGroup pollers
 * @apiSuccess {json} pollers list of pollers or an empty object if there are none.
 */
var pollersGet = controller(function(req) {
    return pollers.getPollers(req.query);
});

/**
 * @api {get} /api/2.0/pollers/:identifier GET /:identifier
 * @apiVersion 2.0.0
 * @apiDescription Get specifics of the specified poller.
 * @apiName poller-get
 * @apiGroup pollers
 * @apiParam {String} identifier String representation of the ObjectId
 * @apiSuccess {json} poller the poller with the <code>id</code>
 * @apiError identifierNotFound The <code>identifier</code> could not be found.
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 404 Not Found
 *     {
 *       "error": "Not Found"
 *     }
 */
var pollersIdGet = controller(function(req) {
    return pollers.getPollersById(req.swagger.params.identifier.value);
});

/**
 * @api {post} /api/2.0/pollers POST /
 * @apiVersion 2.0.0
 * @apiDescription create a poller
 * @apiName pollers-create
 * @apiGroup pollers
 * @apiError E_VALIDATION invalid Attributes.
 * @apiErrorExample E_VALIDATION:
 * {
 *   "error": "E_VALIDATION",
 *   "status": 400,
 *   "summary": "1 attributes are invalid",
 *   "model": "workitems",
 *   "invalidAttributes": {
 *       "pollInterval": [
 *           {
 *               "rule": "integer",
 *               "message":
 *                   "`undefined` should be a integer (instead of \"null\", which is a object)"
 *           },
 *           {
 *               "rule": "required",
 *               "message": "\"required\" validation rule failed for input: null"
 *           }
 *       ]
 *   }
 * }
 */
var pollersPost = controller({success: 201}, function(req) {
    return pollers.postPollers(req.body);
});

/**
 * @api {patch} /api/2.0/pollers/:identifier PATCH /:identifier
 * @apiVersion 2.0.0
 * @apiDescription update a poller
 * @apiName pollers-update
 * @apiGroup pollers
 * @apiParam {String} identifier String representation of the ObjectId
 * @apiSuccess {json} poller the patched poller with the <code>id</code>
 * @apiError NotFound The <code>identifier</code> could not be found.
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 404 Not Found
 *     {
 *       "error": "Not Found"
 *     }
 */
var pollersPatch = controller(function(req) {
    return pollers.patchPollersById(req.swagger.params.identifier.value, req.body);
});

/**
 * @api {delete} /api/2.0/pollers/:identifier DELETE /:id
 * @apiVersion 2.0.0
 * @apiDescription Delete all pollers of specified device.
 * @apiName poller-delete
 * @apiGroup pollers
 * @apiParam {String} identifier String representation of the ObjectId
 * @apiSuccess {nothing} nothing it doesn't return anything if Successful
 * @apiError NotFound The <code>identifier</code> could not be found.
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 404 Not Found
 *     {
 *       "error": "Not Found"
 *     }
 */
var pollersDelete = controller({success: 204}, function(req) {
    return pollers.deletePollersById(req.swagger.params.identifier.value);
});

/**
 * @api {get} /api/2.0/pollers/:identifier/data GET /:identifier/data
 * @apiVersion 2.0.0
 * @apiDescription Get data for the specific poller.
 * @apiName poller-get-data
 * @apiGroup pollers
 * @apiParam {String} identifier (ip address or NodeId) for the data from a poller
 * @apiError NotFound1 The <code>identifier</code> could not be found.
 * @apiError NotFound2 There is no data for the poller with the <code>identifier</code>.
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 404 Not Found
 *     {
 *       "error": "Not Found"
 *     }
 */
var pollersDataGet = controller(function(req) {
    return pollers.getPollersByIdData(req.swagger.params.identifier.value);
});

/**
 * @api {get} /api/2.0/pollers/:identifier/data/current GET /:identifier/data/current
 * @apiVersion 2.0.0
 * @apiDescription Get only the most recent data entry for the specific poller.
 * @apiName poller-get-data-current
 * @apiGroup pollers
 * @apiParam {String} identifier (ip address or NodeId) for the data from a poller
 * @apiError NotFound1 The <code>identifier</code> could not be found.
 * @apiError NotFound2 There is no data for the poller with the <code>identifier</code>.
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 404 Not Found
 *     {
 *       "error": "Not Found"
 *     }
 */
var pollersCurrentDataGet = controller(function(req) {
    return pollers.getPollersByIdDataCurrent(req.swagger.params.identifier.value);
});


module.exports = {
    pollersLibGet: pollersLibGet,
    pollersLibByIdGet: pollersLibByIdGet,
    pollersGet: pollersGet,
    pollersIdGet: pollersIdGet,
    pollersPost: pollersPost,
    pollersPatch: pollersPatch,
    pollersDelete: pollersDelete,
    pollersDataGet: pollersDataGet,
    pollersCurrentDataGet: pollersCurrentDataGet,
};
