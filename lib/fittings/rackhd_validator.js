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
            var suffix = null;
            var service = null;
            if (schemaName === 'obm') {
                if (context.request.method === "PATCH")
                    suffix = '.json#/definitions/ObmPatch';
                else
                    suffix = '.json#/definitions/Obm';
                service = context.request.body.service;
                if (service) {
                    schemaName = service + suffix;
                } else {
                    schemaName = 'noop-obm-service' + suffix;
                }
            }
            else if (schemaName === 'ibm') {
                suffix = '.json#/definitions/Ibm';
                service = context.request.body.service;
                if (service) {
                    schemaName = service + suffix;
                }
            }
            validate(schemaName, context.request.body, next);
        }
    };
};
