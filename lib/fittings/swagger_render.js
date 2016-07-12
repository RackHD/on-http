// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../index.js').injector;
var _ = injector.get('_');

module.exports = function create(fittingDef) {
    injector = require('../../index.js').injector;
    var swag = injector.get('Http.Services.Swagger');
    return function swagger_render(context, next) {    // jshint ignore:line
        if (!context.response.headersSent) {
            var templateNameKey = fittingDef.templateNameKey;
            var operation = context.request.swagger.operation;
            var template = operation[templateNameKey];
            return swag.renderer(context.request, context.response, template, next);
        }
    };
};
