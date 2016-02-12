// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../index.js').injector;

module.exports = function create(fittingDef, bagpipes) {
    var swag = injector.get('Http.Services.Swagger');
    return function swagger_render(context, next) {
        if (!context.response.headersSent) {
            var status = context.request.swagger.options.success || 200;
            var templateNameKey = fittingDef.templateNameKey;
            var operation = context.request.swagger.operation;
            var template = operation[templateNameKey];
            if (template === undefined) {
                context.response.status(status).json(context.response.body);
            } else {
                swag.renderer(template, context.response.body, next).then(function (renderedOutput) {
                    context.response.status(status).json(renderedOutput);
                });
            }
        }
    };
};
