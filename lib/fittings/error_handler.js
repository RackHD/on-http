'use strict';

var util = require('util');
var http = require('http');

module.exports = function create(__, ___, injector) {
    injector = injector || require('../../index.js').injector;
    var _ = injector.get('_');
    var swaggerService = injector.get('Http.Services.Swagger');
    var conf = injector.get('Services.Configuration');
    var constants = injector.get('Constants');
    return function error_handler(context, next) {    // jshint ignore:line
        if (!util.isError(context.error)) { return next(); }

        var err = context.error;
        var ERROR_STATUS = 400;
        var res = context.response;

        if (err instanceof Error) {
            var message = err.message || http.STATUS_CODES[err.status] || 'Unspecified Error';
            if (!err.status || err.status === ERROR_STATUS) {
                res.status(ERROR_STATUS);
                res.locals.errorStatus = ERROR_STATUS;
            } else {
                res.status(err.status);
                res.locals.errorStatus = err.status;
            }

            message = message.replace(/\n/g, '');
            res.body = {
                message: message,
                status: res.locals.errorStatus,
                uuid: res.locals.uuid
            };
            if (err.errors !== undefined) {
                /* Errors come from the swagger_validator fitting out of the
                   swagger-node-runner dependency:
                     https://github.com/theganyo/swagger-node-runner/blob/master/fittings/swagger_validator.js#L24
                   and it's subdependency sway:
                     https://github.com/apigee-127/sway/blob/master/lib/types/operation.js#L236
                   and look like:
                   [
                        { code: 'INVALID_REQUEST_PARAMETER',
                          errors:
                           [ { code: 'OBJECT_MISSING_REQUIRED_PROPERTY',
                               message: 'Missing required property: nodeId',
                               path: [],
                               description: 'OBM settings' } ],
                          in: 'body',
                          message: 'Invalid parameter (body): Value failed JSON Schema validation',
                          name: 'body',
                          path: [ 'paths', '/obms', 'put', 'parameters', '0' ] }
                   ]
                */

                res.body.errors = _(err.errors).map(function(e) {
                    if (e.errors) {
                        return _.map(e.errors, 'message');
                    } else {
                        return e.message || 'Unknown error';
                    }
                }).flatten().compact().value();
            }
            var minLogLevel = conf.get('minLogLevel');
            if (minLogLevel === constants.Logging.Levels.debug) {
                if (err.stack !== undefined) {
                    var stackDump = err.stack.split(/\n/);
                    res.body.stack = stackDump;
                }
            }
            swaggerService.renderer(context.request, context.response, 'error.2.0.json', next);

        } else {
            return next();
        }

        delete(context.error);
    };
};

