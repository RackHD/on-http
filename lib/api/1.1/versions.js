// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    express = require('express');

module.exports = versionRouterFactory;

di.annotate(versionRouterFactory, new di.Provide('Http.Api.Versions'));
di.annotate(versionRouterFactory,
    new di.Inject(
        'Http.Services.RestApi',
        'Http.Services.Api.Versions',
        '_',
        'Logger'
    )
);

function versionRouterFactory (rest, versionApiService, _, Logger) {


    var logger = Logger.initialize(versionRouterFactory);
    var router = express.Router();
    /**
     * @api {get} /api/1.1/versions GET /
     * @apiDescription get versions of packages installed
     * @apiName versions-get
     * @apiGroup versions
     * @apiSuccess {json} version list of all versions
     * @apiSuccessExample {json} Success-Response:
     *     HTTP/1.1 200 Ok
     *     [
     *         {
     *             "package": "on-http",
     *             "version": "1.0-19"
     *         },
     *         {
     *             "package": "on-tftp",
     *             "version": "1.0-19"
     *         },
     *     ]
     *
     * @apiErrorExample {json} Error-Response:
     *     HTTP/1.1 501 Not Implemented
     *
     */
    router.get('/versions', rest(function (req, res) {
        return versionApiService.findVersion(req, res);

    }));
    return router;
}
