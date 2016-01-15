// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;

module.exports = {
    getVersions: getVersions
};

/**
 * @api {get} /api/2.0/versions GET /
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
function getVersions(req, res) {
    var versions = injector.get('Http.Services.Api.Versions');
    versions.findVersion(req, res).then(function (installedVersions) {
        res.json(installedVersions);
    }, function (error) {
        res.json(error);
    });
}
