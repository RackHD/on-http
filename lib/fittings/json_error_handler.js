'use strict';

var util = require('util');
var http = require('http');
var injector = require('../../index').injector;

module.exports = function create(fittingDef, bagpipes) {
    return function error_handler(context, next) {
        if (!util.isError(context.error)) { return next(); }

        var err = context.error;
        var ERROR_STATUS = 400;

        var req = context.request;
        var res = context.response;
        var ErrorEvent = injector.get('ErrorEvent');

        if (err instanceof Error || err instanceof ErrorEvent) {
            console.log(err.message);
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
        } else if (typeof err === 'string') {
            res.status(ERROR_STATUS);
            res.json({
                message: err
            });
        } else {
            res.status(ERROR_STATUS);
            res.json(err);
        }

        delete(context.error);
    };
};

