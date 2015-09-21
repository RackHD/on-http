'use strict';

var di = require('di'),
    ws = require('ws');

module.exports = webSocketServerFactory;

di.annotate(webSocketServerFactory, new di.Provide('WebSocketServer'));

function webSocketServerFactory() {
    return ws.Server;
}
