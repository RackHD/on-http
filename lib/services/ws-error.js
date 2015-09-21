'use strict';

var di = require('di');

module.exports = webSocketErrorFactory;

di.annotate(webSocketErrorFactory, new di.Provide('WebSocketError'));
di.annotate(webSocketErrorFactory, new di.Inject('Errors', 'Util'));

function webSocketErrorFactory(Errors, Util) {
    function WebSocketError(msg, ctx) {
        Errors.BaseError.call(this, msg, ctx);
        Error.captureStackTrace(this, WebSocketError);
    }
    Util.inherits(WebSocketError, Errors.BaseError);
    return WebSocketError;
}
