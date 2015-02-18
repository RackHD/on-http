// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node: true */

'use strict';

var di = require('di'),
    express = require('express');

module.exports = versionRouterFactory;

di.annotate(versionRouterFactory, new di.Provide('Http.Api.Versions'));
di.annotate(versionRouterFactory,
    new di.Inject(
        'common-api-presenter',
        'ChildProcess',
        '_'
    )
);

function versionRouterFactory (presenter, ChildProcess, _) {
    var router = express.Router();
    /**
     * @api {get} /api/common/versions GET /
     * @apiDescription get server package versions installed
     * @apiName config-get
     * @apiGroup config
     */

    router.get('/versions', presenter.middleware(function () {
        var process = new ChildProcess().run("/usr/bin/dpkg", ["-l", "renasar-*"]);
        return process.then(function(results) {
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
        });
    }));

    return router;
}
