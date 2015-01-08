// Copyright 2014, Renasar Technologies Inc.
/* jshint node: true */

'use strict';

var di = require('di'),
    express = require('express'),
    router = express.Router();

module.exports = logfileRouterFactory;

di.annotate(logfileRouterFactory,
    new di.Inject(
        'Services.Configuration'
    )
);

function logfileRouterFactory (configuration) {

    router.use('/logs', express.static(configuration.get('logfileLocation')));
    /**
     * @api {get} /api/common/logs/renasar-pxe.log GET /renasar-pxe.log
     * @apiDescription get the log file from the renasar engine
     * @apiName logs-get
     * @apiGroup logs
     */

    return router;
}
