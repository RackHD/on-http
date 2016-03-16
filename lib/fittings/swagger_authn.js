// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../index.js').injector;
var debug = require('debug')('swagger:authn');

module.exports = function create(fittingDef, bagpipes) {
    var authn = injector.get('Auth.Services');
    var runner = bagpipes.config.swaggerNodeRunner;
    var authEnabled = runner.config.swagger.authEnabled;
    return function swagger_authn(context, next) {    // jshint ignore:line
        var operation = context.request.swagger.operation;
        var authType = operation['x-authentication-type'];
        if(!authEnabled || !authType) {
            debug('skipping authn');
            return next();
        }
        return authn.authenticateWithMethod(context.request, context.response, next, authType);
    };
};
