// Copyright 2015, Renasar Technologies Inc.
/* jshint node: true */

'use strict';

var di = require('di');
var sockjs = require('sockjs');
var http = require('http');
var https = require('https');
var net = require('net');

module.exports = sockJsServerFactory;

di.annotate(sockJsServerFactory, new di.Provide('SockJS.Server'));
di.annotate(sockJsServerFactory,
    new di.Inject(
        'stomp',
        'Logger',
        'Services.Configuration'
    )
);

function sockJsServerFactory(stomp, Logger, configuration) {

    var logger = Logger.initialize(sockJsServerFactory);

    function SockJsServer() {}

    SockJsServer.prototype.listen = function listen(externalServer) {
        var listener;
        var prefix = configuration.get('sockJsStompPrefix');

        if (externalServer instanceof http.Server || externalServer instanceof https.Server) {
            var options = {
                log: logger.log.bind(logger),
                prefix: prefix
            };
            var sockjsServer = sockjs.createServer();
            listener = stomp.attach(sockjsServer);
            sockjsServer.installHandlers(externalServer, options);
        } else if (externalServer instanceof net.Server) {
            listener = stomp.attach(externalServer);
        } else {
            throw new Error('argument must be an http, https or net server');
        }
        return listener;
    };

    return new SockJsServer();
}
