// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node: true */

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

    router.get('/schemas', rest(function () {
        return schemas;
    }));

    router.get('/schemas/:id', rest(function (req) {
        return _.find(schemas, function (schema) {
            return schema.id === req.params.id;
        });
    }));

    return router;
}

