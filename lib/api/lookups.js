// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node: true */

'use strict';

var di = require('di'),
    express = require('express');

module.exports = lookupsRouterFactory;

di.annotate(lookupsRouterFactory, new di.Provide('Http.Api.Lookup'));
di.annotate(lookupsRouterFactory,
    new di.Inject(
        'Services.Waterline',
        'Http.Services.RestApi'
    )
);

function lookupsRouterFactory (waterline, rest) {
    var router = express.Router();

    router.get('/lookups', rest(function (req) {
        return waterline.lookups.findByTerm(req.query.q);
    }, {
        serializer: 'Serializable.V1.Lookup',
        isArray: true
    }));

    router.post('/lookups', rest(function (req) {
        return waterline.lookups.create(req.body);
    }));

    router.get('/lookups/:id', rest(function (req) {
        return waterline.lookups.needOneById(req.params.id);
    }, {
        serializer: 'Serializable.V1.Lookup'
    }));

    router.patch('/lookups/:id', rest(function (req) {
        return waterline.lookups.updateOneById(req.params.id, req.body);
    }, {
        serializer: 'Serializable.V1.Lookup',
        deserializer: 'Serializable.V1.Lookup'
    }));

    router.delete('/lookups/:id', rest(function (req) {
        return waterline.lookups.destroyOneById(req.params.id);
    }, {
        serializer: 'Serializable.V1.Lookup'
    }));

    return router;
}

