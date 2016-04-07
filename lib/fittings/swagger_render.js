// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../index.js').injector;
var _ = injector.get('_');

module.exports = function create(fittingDef) {
    var swag = injector.get('Http.Services.Swagger');
    return function swagger_render(context, next) {    // jshint ignore:line
        if (!context.response.headersSent) {
            var status = context.request.swagger.options.success || 200;
            var templateNameKey = fittingDef.templateNameKey;
            var operation = context.request.swagger.operation;
            var template = operation[templateNameKey];
            if (template === undefined) {
                if (_.isEmpty(context.response.body) &&
                    context.request.swagger.options.send204OnEmpty )
                {
                    status = 204;
                }
                context.response.status(status).send(context.response.body);
            } else {
                swag.renderer(template, context.request.swagger.options.rendererOptions, next)
                .then(function (renderedOutput) {
                    context.response.status(status).send(renderedOutput);
                });
            }
        }
    };
};
