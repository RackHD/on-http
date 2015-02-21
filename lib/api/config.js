// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node: true */

'use strict';

var di = require('di'),
    _ = require('lodash'),
    express = require('express'),
    parser = require('body-parser');

module.exports = configRouterFactory;

di.annotate(configRouterFactory, new di.Provide('Http.Api.Config'));
di.annotate(configRouterFactory,
    new di.Inject(
        'Services.Configuration',
        'common-api-presenter',
        'Logger',
        'Tracer'
    )
);

function configRouterFactory (configuration, presenter) {
    var router = express.Router();
    /**
     * @api {get} /api/1.1/config/ GET /
     * @apiVersion 1.1.0
     * @apiDescription get server configuration
     * @apiName config-get
     * @apiGroup config
     */

    //TODO(heckj) update to request configuration of specific services, not just HTTP
    router.get('/config', presenter.middleware(function () {
        return configuration.getAll();
    }));

    /**
     * @api {patch} /api/1.1/config/ PATCH /
     * @apiVersion 1.1.0
     * @apiDescription patch specific configuration
     * @apiName config-patch
     * @apiGroup config
     */

    router.patch('/config', parser.json(), presenter.middleware(function (req) {
        _.forOwn(req.body, function (value, key) {
            configuration.set(key, value);
        });

        return configuration.getAll();
    }));

    return router;
}
