// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di'),
    express = require('express');

module.exports = versionRouterFactory;

di.annotate(versionRouterFactory, new di.Provide('Http.Api.Versions'));
di.annotate(versionRouterFactory,
    new di.Inject(
        'Http.Services.RestApi',
        'Http.Services.Api.Versions'
    )
);

function versionRouterFactory (rest, versionApiService) {


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
        var result = versionApiService.findVersion();
        result.then(function (installedVersions) {
            if ('error' in installedVersions) {
                res.status(501);
            }
        });
        return result;

    }));
    return router;
}
