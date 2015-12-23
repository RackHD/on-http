// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    express = require('express');

module.exports = lookupsRouterFactory;

di.annotate(lookupsRouterFactory, new di.Provide('Http.Api.Lookups'));
di.annotate(lookupsRouterFactory,
    new di.Inject(
        'Services.Waterline',
        'Http.Services.RestApi'
    )
);

function lookupsRouterFactory (waterline, rest) {
    var router = express.Router();

    /**
     * @api {get} /api/1.1/lookups GET /?q=
     * @apiVersion 1.1.0
     * @apiDescription get list of lookups
     * @apiName lookups-get
     * @apiParam {query} q Query term to lookup by node, macAddress, or ipAddress.
     * @apiGroup lookups
     * @apiSuccess {json} lookups List of all lookups or if there are none an empty object.
     */
    router.get('/lookups', rest(function (req) {
        return waterline.lookups.findByTerm(req.query.q);
    }, {
        serializer: 'Serializables.V1.Lookup',
        isArray: true
    }));

    /**
     * @api {post} /api/1.1/lookups POST /
     * @apiVersion 1.1.0
     * @apiDescription create a lookup
     * @apiName lookups-post
     * @apiParam {String} macAddress MAC Address for the Lookup Record
     * @apiParam {String} ipAddress IP Address associated with the MAC Address
     * @apiParam {String} node Node associated with the Lookup Record
     * @apiGroup lookups
     * @apiSuccess {json} lookup the lookup that was created
    */
    router.post('/lookups', rest(function (req) {
        return waterline.lookups.create(req.body);
    }, {
        serializer: 'Serializables.V1.Lookup',
        deserializer: 'Serializables.V1.Lookup'
    }));

    /**
     * @api {get} /api/1.1/lookups/:id GET /:id
     * @apiVersion 1.1.0
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
    router.get('/lookups/:id', rest(function (req) {
        return waterline.lookups.needOneById(req.params.id);
    }, {
        serializer: 'Serializables.V1.Lookup'
    }));

    /**
     * @api {patch} /api/1.1/lookups/:id PATCH /:id
     * @apiVersion 1.1.0
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
    router.patch('/lookups/:id', rest(function (req) {
        return waterline.lookups.updateOneById(req.params.id, req.body);
    }, {
        serializer: 'Serializables.V1.Lookup',
        deserializer: 'Serializables.V1.Lookup'
    }));

    /**
     * @api {delete} /api/1.1/lookups/:id DELETE /:id
     * @apiVersion 1.1.0
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
    router.delete('/lookups/:id', rest(function (req) {
        return waterline.lookups.destroyOneById(req.params.id);
    }, {
        serializer: 'Serializables.V1.Lookup'
    }));

    return router;
}
