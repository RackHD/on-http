// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../index.js').injector;
var validator = injector.get('Http.Services.Swagger').validator;

module.exports = function create(fittingDef) {
    var validate = validator();
    return function swagger_validator(context, next) {    // jshint ignore:line
        if (!context.response.headersSent) {
            var schemaNameKey = fittingDef.schemaNameKey;
            var operation = context.request.swagger.operation;
            var schemaName = operation[schemaNameKey];
            validate(schemaName, context.request.body, next);
        }
    };
};
