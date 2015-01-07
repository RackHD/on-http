// Copyright 2014, Renasar Technologies Inc.
/* jshint node: true */
'use strict';

var di = require('di'),
    // TODO: re-enable
    //_ = require('lodash'),
    express = require('express'),
    cors = require('cors'),
    onFinished = require('on-finished');

/**
 * Get remote address of the client.
 * @private
 * @param {express.Request} req from express
 * @returns {String|Undefined} either the ip of requester or undefined
 *                             if unavailable
 */
function remoteAddress(req) {
    if (req.ip) {
        return req.ip;
    }

    if (req._remoteAddress) {
        return req._remoteAddress;
    }

    if (req.connection) {
        return req.connection.remoteAddress;
    }

    return undefined;
}

module.exports = httpServiceFactory;

di.annotate(httpServiceFactory, new di.Provide('Server.Http'));
di.annotate(httpServiceFactory,
    new di.Inject(
            'Protocol.Http',
            'Services.Configuration',
            'Protocol.Dhcp',
            'express-app',
            'Logger'
            // TODO: re-enable
            // 'Services.Statsd'
            //'Services.Websocket'
        )
    );

/**
 * Factory that creates the express http service
 * @private
 * @param {httpProtocol} httpProtocol
 * @param {configuration} configuration
 * @param {Protocol.Dhcp} dhcpProtocol
 * @param {express} app
 * @param Logger
 * @param {WebSocketService} websocketService
 * @returns {express}
 */
function httpServiceFactory(
    httpProtocol,
    configuration,
    dhcpProtocol,
    app,
    Logger
    // TODO: re-enable
    //statsd
    //websocketService
) {
    var logger = Logger.initialize(httpServiceFactory);

    function isRouterPath(req) {
        return req.route !== undefined && req.baseUrl !== undefined;
    }

    // TODO: re-enable
    /*
    function extractMonitoringPath(req, res){
        var path = '';

        // grab the url, replacing / with .
        path = 'mount' + req.baseUrl.replace(/\//g, '.');

        // take the current route and replace / with .
        path += req.route.path.replace(/\//g, '.');

        // sort the key names of all parameters and join them with .
        if(_.keys(req.query).length > 0) {
            path += _.keys(req.query).sort().join('.') + '.';
        }

        // method (usually get, post, etc.
        path += req.method.toLowerCase();

        // status code of response
        path += '.' + res.statusCode;

        return path;
    }
    */

    function httpEventMiddleware(req, res, next) {
        req._startAt = process.hrtime();
        var ipAddress = remoteAddress(req);

        dhcpProtocol.ipInRange(ipAddress).then(function (inRange) {
            if (!inRange) {
                next();
            } else {
                onFinished(res, function () {
                    if (!req._startAt) {
                        return '';
                    }

                    var diff = process.hrtime(req._startAt);
                    var ms = diff[0] * 1e3 + diff[1] * 1e-6;

                    httpProtocol.publishResponse({
                        address: ipAddress,
                        method: req.method,
                        url: req.originalUrl,
                        statusCode: res.statusCode,
                        time: ms.toFixed(3)
                    });

                    logger.silly(
                        'http: ' + req.method +
                        ' ' + res.statusCode +
                        ' ' + ms.toFixed(3) +
                        ' - ' + req.originalUrl,
                        {
                            ip: ipAddress
                        }
                    );

                    if(isRouterPath(req)) {
                        // TODO: re-enable
                        /*
                        statsd.gauge(
                            extractMonitoringPath(req, res),
                            ms.toFixed(3)
                        );
                        */
                        req;  // appease the linter (empty block) until re-enable of statsd
                    }
                });

                next();
            }
        });
    }

    // CORS Support
    app.use(cors());
    app.options('*', cors());

    // Imaging Event Middleware
    app.use(httpEventMiddleware);

    // Serve Static Content
    app.use(express.static(configuration.get('httpStaticDirectory')));
    app.use(express.static(configuration.get('httpFrontendDirectory')));
    app.use("/docs", express.static(configuration.get('httpApiDocsDirectory')));

    // Extend HTTP to include web sockets
    app.listen = function() {
      var server = require('http').createServer(this);
      // TODO: re-enable
      //websocketService.listen(server);
      return server.listen.apply(server, arguments);
    };

    return app;
}
