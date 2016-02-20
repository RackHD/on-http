'use strict';

var path = require('path');
var _ = require('lodash');    // jshint ignore:line

module.exports = function create(fittingDef, bagpipes) {
    var swaggerNodeRunner = bagpipes.config.swaggerNodeRunner;
    var appRoot = swaggerNodeRunner.config.swagger.appRoot;
    var serdesDirs = fittingDef.serdesDirs.map(function(dir) {
        return path.resolve(appRoot, dir);
    });
    var serdesFunctionCache = {};

    return function swaggerSerdes(context, next) {
        var serdesNameKey = fittingDef.serdesNameKey;
        var operation = context.request.swagger.operation;
        var serdesName;
        var serdes;

        try {
            serdesName = operation[serdesNameKey] || operation.pathObject[serdesNameKey];
            if (!serdesName) { return next(); }
        } catch (err) {
            // serdes is optional, hand off to the next fitting if serdesName is undefined.
            return next();
        }

        if (serdesName in serdesFunctionCache) {
            serdes = serdesFunctionCache[serdesName];
        } else {
            var requireError;
            var pathNotFound = _.every(serdesDirs, function(dir) {
                var serdesPath = path.resolve(dir, serdesName);
                try {
                    serdes = require(serdesPath);
                    serdesFunctionCache[serdesName] = serdes;
                    return false;
                } catch (err) {
                    requireError = err;
                    return true;
                }
            });
            if (pathNotFound) { return next(requireError); }
        }
        if (serdes) {
            var serdesFunction = serdes[operation.operationId];
            if (serdesFunction && typeof serdesFunction === 'function') {
                return serdesFunction(context.request, context.response, next);
            }
        }
        next(new Error('No serdes found for ' + serdesName));
    };
};

