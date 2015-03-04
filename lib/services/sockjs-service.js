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
        'Assert',
        'Services.Configuration'
    )
);

function sockJsServerFactory(stomp, Logger, assert, configuration) {

    var logger = Logger.initialize(sockJsServerFactory);

    function SockJsServer() {}

    SockJsServer.prototype.listen = function listen(externalServer) {
        var prefix = configuration.get('sockJsStompPrefix');

        assert.ok(externalServer instanceof http.Server ||
                  externalServer instanceof https.Server ||
                 externalServer instanceof net.Server,
                 "argument must be an http, https or tcp server");

        if (externalServer instanceof http.Server || externalServer instanceof https.Server) {
            var options = {
                log: logger.log.bind(logger),
                prefix: prefix
            };
            var sockjsServer = sockjs.createServer();
            var listener = stomp.attach(sockjsServer);
            sockjsServer.installHandlers(externalServer, options);
            return listener;
        }
        return stomp.attach(externalServer);
    };

    return new SockJsServer();
}
