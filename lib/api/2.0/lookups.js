// Copyright 2016, EMC Inc.

'use strict';
var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var waterline = injector.get('Services.Waterline');

/**
 * @api {get} /api/2.0/lookups GET /?q=
 * @apiVersion 2.0.0
 * @apiDescription get list of lookups
 * @apiName lookups-get
 * @apiParam {query} q Query term to lookup by node, macAddress, or ipAddress.
 * @apiGroup lookups
 * @apiSuccess {json} lookups List of all lookups or if there are none an empty object.
 */
var lookupsGet = controller(function (req) {
    return waterline.lookups.findByTerm(req.swagger.query.q);
});

/**
 * @api {post} /api/2.0/lookups POST /
 * @apiVersion 2.0.0
 * @apiDescription create a lookup
 * @apiName lookups-post
 * @apiParam {String} macAddress MAC Address for the Lookup Record
 * @apiParam {String} ipAddress IP Address associated with the MAC Address
 * @apiParam {String} node Node associated with the Lookup Record
 * @apiGroup lookups
 * @apiSuccess {json} lookup the lookup that was created
 */

var lookupsPost = controller({success: 201}, function (req) {
    return waterline.lookups.create(req.swagger.params.body.value);
});

/**
 * @api {get} /api/2.0/lookups/:id GET /:id
 * @apiVersion 2.0.0
 * @apiDescription get specific lookup details
 * @apiName lookup-get
 * @apiGroup lookups
 * @apiParam {String} id lookup id
 * @apiSuccess {json} lookup the lookups that have the <code>id</code>
 * @apiError NotFound The lookup with the <code>id</code> was not found.
 * @apiErrorExample {json} Error-Response:
 *     HTTP/1.1 404 Not Found
 *     {
 *       "error": "Not Found"
 *      }
 */
var lookupsGetById = controller(function (req) {
    return waterline.lookups.needOneById(req.swagger.params.id.value);
});

/**
 * @api {patch} /api/2.0/lookups/:id PATCH /:id
 * @apiVersion 2.0.0
 * @apiDescription patch specific lookup details
 * @apiName lookup-patch
 * @apiGroup lookups
 * @apiParam {String} id lookup id
 * @apiSuccess {json} lookup the lookup that has the <code>id</code> that was patched
 * @apiError NotFound The lookup with the <code>id</code> was not found.
 * @apiErrorExample {json} Error-Response:
 *     HTTP/1.1 404 Not Found
 *     {
 *       "error": "Not Found"
 *      }
 */
var lookupsPatchById = controller(function(req) {
    return waterline.lookups.updateOneById(req.swagger.params.id.value,
                                           req.swagger.params.body.value);
});

/**
 * @api {delete} /api/2.0/lookups/:id DELETE /:id
 * @apiVersion 2.0.0
 * @apiDescription Delete specific lookup details.
 * @apiName lookup-delete
 * @apiGroup lookups
 * @apiParam {String} id lookup id
 * @apiSuccess {json} lookup the lookup that has the <code>id</code> that was patched
 * @apiError NotFound The lookup with the <code>id</code> was not found.
 * @apiErrorExample {json} Error-Response:
 *     HTTP/1.1 404 Not Found
 *     {
 *       "error": "Not Found"
 *      }
 */
var lookupsDelById = controller({success: 204}, function (req) {
    return waterline.lookups.destroyOneById(req.swagger.params.id.value);
});

module.exports = {
    lookupsGet: lookupsGet,
    lookupsPost: lookupsPost,
    lookupsGetById: lookupsGetById,
    lookupsPatchById: lookupsPatchById,
    lookupsDelById: lookupsDelById
};
