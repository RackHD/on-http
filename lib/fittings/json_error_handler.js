'use strict';

var util = require('util');
var http = require('http');

module.exports = function create(fittingDef, bagpipes) {
    return function error_handler(context, next) {
        if (!util.isError(context.error)) { return next(); }

        var err = context.error;
        var ERROR_STATUS = 400;

        var res = context.response;

        if (err instanceof Error) {
            var message = err.message || http.STATUS_CODES[err.status] || 'Unspecified Error';
            if (!err.status || err.status === ERROR_STATUS) {
                res.status(ERROR_STATUS);
                res.json({
                    message: message
                });
            } else {
                res.status(err.status);
                res.json({
                    message: message
                });
            }
        } else {
            return next();
        }

        delete(context.error);
    };
};

