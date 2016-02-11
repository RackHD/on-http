'use strict';

module.exports = function create(fittingDef, bagpipes) {
    return function swagger_render(context, next) {
        if (!context.response.headersSent) {
            var status = context.request.swagger.options.success || 200;
            context.response.status(status).json(context.response.body);
        }
    };
};

