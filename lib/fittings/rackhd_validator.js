// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../index.js').injector;
var validator = injector.get('Http.Services.Swagger').validator;
var configuration = injector.get('Services.Configuration');

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
            var credentials = configuration.get("defaultIbms");
            if (credentials !== undefined
                && context.request.method === "PUT"
                && context.request.originalUrl === "/api/2.0/ibms"
                && context.request.body.config !== undefined
                && context.request.body.config.user === undefined
                && context.request.body.config.password === undefined
            ) {
                context.request.body.config.user = credentials.user;
                context.request.body.config.password = credentials.password;
            }
            validate(schemaName, context.request.body, next);
        }
    };
};
