// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    express = require('express');

module.exports = schemasRouterFactory;

di.annotate(schemasRouterFactory, new di.Provide('Http.Api.Schemas'));
di.annotate(schemasRouterFactory,
    new di.Inject(
        '_',
        'Http.Services.RestApi',
        di.Injector
    )
);

function schemasRouterFactory (_, rest, injector) {
    var router = express.Router();

    var schemas = _.map(injector.getMatching('Serializables.V1.*'), function (item) {
        return item.schema;
    });

    /**
     * @api {get} /api/1.1/schemas/ GET /
     * @apiVersion 1.1.0
     * @apiDescription get list of schemas
     * @apiName schemas-get
     * @apiGroup schemas
     * @apiSuccess {json} schemas List of all schemas or if there are none an empty object.
     */
    router.get('/schemas', rest(function () {
        return schemas;
    }));

    /**
     * @api {get} /api/1.1/schemas/:id GET /:id
     * @apiVersion 1.1.0
     * @apiDescription get specific schema details
     * @apiName schema-get
     * @apiGroup schemas
     * @apiParam {String} id schema id
     * @apiSuccess {json} schema the schemas that have the <code>id</code>
     * @apiError NotFound The schema with the <code>id</code> was not found.
     * @apiErrorExample {json} Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *      }
     */
    router.get('/schemas/:id', rest(function (req) {
        return _.find(schemas, function (schema) {
            return schema.id === req.params.id;
        });
    }));

    return router;
}
