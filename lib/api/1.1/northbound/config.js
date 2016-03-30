// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    express = require('express');

module.exports = configRouterFactory;

di.annotate(configRouterFactory, new di.Provide('Http.Api.Config'));
di.annotate(configRouterFactory,
    new di.Inject(
        'Http.Services.RestApi',
        'Http.Services.Api.Config'
    )
);

function configRouterFactory (rest, config) {
    var router = express.Router();
    /**
     * @api {get} /api/1.1/config/ GET /
     * @apiVersion 1.1.0
     * @apiDescription get server configuration
     * @apiName config-get
     * @apiGroup config
     */

    //TODO(heckj) update to request configuration of specific services, not just HTTP
    router.get('/config', rest(function () {
        return config.configGetAll();
    }));

    /**
     * @api {patch} /api/1.1/config/ PATCH /
     * @apiVersion 1.1.0
     * @apiDescription patch specific configuration
     * @apiName config-patch
     * @apiGroup config
     */

    router.patch('/config', rest(function (req) {
        return config.configSet(req.body);
    }));

    return router;
}
