'use strict';

module.exports = function create(fittingDef, bagpipes) {
    return function swagger_render(context, next) {
        if (!context.response.headersSent) {
            context.response.json(context.response.body);
        }
    };
};

