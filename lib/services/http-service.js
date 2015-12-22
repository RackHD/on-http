// Copyright 2015, EMC, Inc.

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
            'Errors',
            'Services.WebSocket',
            'Http.Services.SkuPack'
        )
    );

/**
 * Factory that creates the express http service
 * @private
 * @param {Protocol.Events} eventsProtocol
 * @param {Services.Configuration} configuration
 * @param {Services.Lookup} lokupService
 * @param {express} app
 * @param Logger
 * @param Q
 * @param {common-api-router} router
 * @param {Events} events
 * @param Errors
 * @param {Services.WebSocket} wss
 * @returns {express} app
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
    Errors,
    wss,
    skuService
) {
    var logger = Logger.initialize(httpServiceFactory),
        servers = [];

    app.listen = function() {
        var promises = [];

        function httpEventMiddleware(req, res, next) {
            req._startAt = process.hrtime();
            res.locals.ipAddress = remoteAddress(req);
            res.locals.scope = ['global'];

            onFinished(res, function () {
                if (!req._startAt) {
                    return '';
                }

                var diff = process.hrtime(req._startAt),
                    ms = diff[0] * 1e3 + diff[1] * 1e-6;

                var data = {
                    ipAddress: res.locals.ipAddress
                };

                if (res.locals.identifier) {
                    data.id = res.locals.identifier;
                }

                logger.debug(
                    'http: ' + req.method +
                    ' ' + res.statusCode +
                    ' ' + ms.toFixed(3) +
                    ' - ' + req.originalUrl,
                    data
                );

                eventsProtocol.publishHttpResponse(
                    res.locals.identifier || 'external',
                    {
                        address: res.locals.ipAddress,
                        method: req.method,
                        url: req.originalUrl,
                        statusCode: res.statusCode,
                        time: ms.toFixed(3)
                    }
                );
            });

            lookupService.ipAddressToNodeId(res.locals.ipAddress).then(function (nodeId) {
                res.locals.identifier = nodeId;
            }).catch(Errors.NotFoundError, function () {
                // No longer log NotFoundErrors
            }).catch(function (error) {
                events.ignoreError(error);
            }).finally(function () {
                next();
            });
        }

        // CORS Support
        app.use(cors());
        app.options('*', cors());

        // Imaging Event Middleware
        app.use(httpEventMiddleware);

        // Override default static directory with sku specific handlers
        app.use(function(req, res, next) {
            skuService.static(req, res, next);
        });

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

            wss.start(httpServer);

            httpServer.on('close', function() {
                console.log("HTTP server closing");
            });

            promises.push(new Promise(function (resolve, reject) {
                httpServer.listen(
                    configuration.get('httpBindPort', 80),
                    configuration.get('httpBindAddress', '0.0.0.0'),
                    function (error) { return error ? reject(error) : resolve(); }
                );
            }));

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

            wss.start(httpsServer, {
                secureOptions: httpsOptions
            });

            httpsServer.on('close', function() {
                console.log("HTTPS server closing");
            });

            promises.push(new Promise(function (resolve, reject) {
                httpsServer.listen(
                    configuration.get('httpsBindPort', 443),
                    configuration.get('httpsBindAddress', '0.0.0.0'),
                    function (error) { return error ? reject(error) : resolve(); }
                );
            }));

            servers.push(httpsServer);
        }

        if (!servers.length) {
            throw new Error('No servers present, http and https config options both disabled!');
        }

        return Promise.all(promises);
    };

    app.close = function() {
        var promises = Promise.all(servers.map(function (server) {
            return Promise.fromNode(server.close.bind(server));
        }));
        wss.stop();
        servers = [];
        return promises;
    };

    return app;
}
