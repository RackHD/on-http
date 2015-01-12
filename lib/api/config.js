// Copyright 2014, Renasar Technologies Inc.
/* jshint node: true */

'use strict';

var di = require('di'),
    _ = require('lodash'),
    express = require('express'),
    router = express.Router(),
    parser = require('body-parser');

router.use(parser.json());

module.exports = logfileRouterFactory;

di.annotate(logfileRouterFactory,
    new di.Inject(
        'Services.Configuration',
        'common-api-presenter',
        'Logger'
    )
);

function logfileRouterFactory (configuration, presenter, Logger) {
    var logger = Logger.initialize(logfileRouterFactory);
    /**
     * @api {get} /api/common/config/ GET /
     * @apiDescription get server configuration
     * @apiName config-get
     * @apiGroup config
     */

    router.get('/config', presenter.middleware(function () {
        return configuration.get();
    }));

    /**
     * @api {patch} /api/common/config/ PATCH /
     * @apiDescription patch specific configuration
     * @apiName config-patch
     * @apiGroup config
     */

    router.patch('/config', presenter.middleware(function (req) {
        _.forOwn(req.body, function (value, key) {
            configuration.set(key, value);
        });

        return configuration.get();
    }));

    return router;
}
