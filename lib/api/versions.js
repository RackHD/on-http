// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    express = require('express');

module.exports = versionRouterFactory;

di.annotate(versionRouterFactory, new di.Provide('Http.Api.Versions'));
di.annotate(versionRouterFactory,
    new di.Inject(
        'Http.Services.RestApi',
        'ChildProcess',
        '_',
        'Logger'
    )
);

function versionRouterFactory (rest, ChildProcess, _, Logger) {
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
        var process = new ChildProcess("/usr/bin/dpkg", ["-l", "on-*"]);
        return process.run().then(function(results) {
            // break up the STDOUT into an array of lines
            var lines = results.stdout.split('\n');
            // grab the lines that start with "ii " - indicating package listings
            var packagelines = _.filter(lines, function(line) { return line.match(/^ii\s/); });
            // convert the raw string lines into objects
            var transformed = _.transform(packagelines, function(result, item) {
                // parse out the fields - split on one or more whitespace characters
                var fields = item.split(/\s+/);
                // generate a dict of package, version keys for each line
                return result.push({
                    'package': fields[1],
                    'version': fields[2]
                });
            });
            return transformed;
        }).catch(function(error) {
            logger.warning("Unable to retrieve package versions", { error: error });
            res.status(501);
            return { 'error': 'Not Implemented' };
        });
    }));

    return router;
}
