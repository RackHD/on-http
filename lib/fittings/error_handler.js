'use strict';

var util = require('util');
var http = require('http');

module.exports = function create() {
    var injector = require('../../index.js').injector;
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

