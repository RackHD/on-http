// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di');

module.exports = versionApiServiceFactory;
di.annotate(versionApiServiceFactory, new di.Provide('Http.Services.Api.Versions'));
di.annotate(versionApiServiceFactory,
    new di.Inject(
        'Logger',
        'ChildProcess',
        '_'
    )
);
function versionApiServiceFactory(
    Logger,
    ChildProcess,
    _
) {
    var logger = Logger.initialize(versionApiServiceFactory);

    function VersionApiService() {
    }

    /**
     * Find the installed versions
     * @param {Object} [req] HTTP request
     * @param {Object} [res] HTTP response
     * @return {Promise}
     */
    VersionApiService.prototype.findVersion = function(req, res) {

        // Find the enclosure nodes who enclose this compute node
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


    };

    return new VersionApiService();
}
