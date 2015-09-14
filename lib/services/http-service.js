// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node: true */
'use strict';

var di = require('di');
var express = require('express');
var cors = require('cors');
var onFinished = require('on-finished');
var http = require('http');
var https = require('https');
var fs = require('fs');

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

di.annotate(httpServiceFactory, new di.Provide('Http.Server'));
di.annotate(httpServiceFactory,
    new di.Inject(
            'Protocol.Events',
            'Services.Configuration',
            'Services.Lookup',
            'express-app',
            'Logger',
            'Promise',
            'common-api-router',
            'Events',
            'Errors'
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
    eventsProtocol,
    configuration,
    lookupService,
    app,
    Logger,
    Promise,
    router,
    events,
    Errors
) {
    var logger = Logger.initialize(httpServiceFactory),
        servers = [];

    // Extend HTTP to include web sockets
    app.listen = function() {
        function httpEventMiddleware(req, res, next) {
            req._startAt = process.hrtime();
            var ipAddress = remoteAddress(req);
            var identifier;

            onFinished(res, function () {
                if (!req._startAt) {
                    return '';
                }

                var diff = process.hrtime(req._startAt),
                    ms = diff[0] * 1e3 + diff[1] * 1e-6;

                lookupService.ipAddressToNodeId(ipAddress).then(function (nodeId) {
                    identifier = nodeId;
                }).catch(Errors.NotFoundError, function () {
                    // No longer log NotFoundErrors
                }).catch(function (error) {
                    events.ignoreError(error);
                }).finally(function () {
                    var data = {
                        ipAddress: ipAddress
                    };

                    if (identifier) {
                        data.id = identifier;
                    }

                    logger.silly(
                        'http: ' + req.method +
                        ' ' + res.statusCode +
                        ' ' + ms.toFixed(3) +
                        ' - ' + req.originalUrl,
                        data
                    );

                    eventsProtocol.publishHttpResponse(
                        identifier || 'external',
                        {
                            address: ipAddress,
                            method: req.method,
                            url: req.originalUrl,
                            statusCode: res.statusCode,
                            time: ms.toFixed(3)
                        }
                    );
                });
            });

            next();
        }

        // CORS Support
        app.use(cors());
        app.options('*', cors());

        // Imaging Event Middleware
        app.use(httpEventMiddleware);

        // Default Static Directory
        app.use(express.static('./static/http'));

        // Additional Static Directory
        app.use(
            express.static(
                configuration.get('httpStaticRoot', '/opt/monorail/static/http')
            )
        );

        // API Docs Directory
        app.use('/docs',
            express.static(
                configuration.get('httpDocsRoot', './build/apidoc')
            )
        );

        // Mount API Routers
        app.use('/api/common', router);
        app.use('/api/current', router);
        app.use('/api/1.1', router);

        if (configuration.get('httpEnabled', true)) {
            var httpServer = http.createServer(this);

            httpServer.on('close', function() {
                console.log("HTTP server closing");
            });

            httpServer.listen(
                configuration.get('httpBindPort', 80),
                configuration.get('httpBindAddress', '0.0.0.0')
            );

            servers.push(httpServer);
        }
        if (configuration.get('httpsEnabled', false)) {
            var httpsOptions;
            var pfx = configuration.get('httpsPfx', null);

            if (pfx) {
                httpsOptions = {
                    pfx: fs.readFileSync(pfx)
                };
            } else {
                httpsOptions = {
                    cert: fs.readFileSync(
                        configuration.get('httpsCert', './data/dev-cert.pem')
                    ),
                    key: fs.readFileSync(
                        configuration.get('httpsKey', './data/dev-key.pem')
                    )
                };
            }
            var httpsServer = https.createServer(httpsOptions, this);

            httpsServer.on('close', function() {
                console.log("HTTPS server closing");
            });

            httpsServer.listen(
                configuration.get('httpsBindPort', 443),
                configuration.get('httpsBindAddress', '0.0.0.0')
            );

            servers.push(httpsServer);
        }

        if (!servers.length) {
            throw new Error('No servers present, http and https config options both disabled!');
        }
    };

    app.close = function() {
        var promises = Promise.all(servers.map(function (server) {
            return Promise.fromNode(server.close.bind(server));
        }));
        servers = [];
        return promises;
    };

    return app;
}
