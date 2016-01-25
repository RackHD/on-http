// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di');
var express = require('express');
var cors = require('cors');
var onFinished = require('on-finished');
var http = require('http');
var https = require('https');
var fs = require('fs');
var proxy = require('express-http-proxy');
var path = require('path');

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
        'swagger',
        'Logger',
        'Promise',
        'common-api-router',
        'Events',
        'Errors',
        'Services.WebSocket',
        'Http.Services.SkuPack',
        '_'
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
    swagger,
    Logger,
    Promise,
    router,
    events,
    Errors,
    wss,
    skuService,
    _
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

        //Swagger support
        var swaggerConfig = {
            appRoot: path.resolve(__dirname, '../../'),
            configDir: path.resolve(__dirname, '../../swagger_config'),
            swagger: path.resolve(__dirname, '../../static/monorail-2.0.yaml'),
        };
        
        var redfishConfig = {
            appRoot: path.resolve(__dirname, '../../'),
            configDir: path.resolve(__dirname, '../../swagger_config'),
            swagger: path.resolve(__dirname, '../../static/redfish.yaml'),
        };
        
        var swaggerCreateAsync = Promise.promisify(swagger.create);
        
        promises.push(swaggerCreateAsync(swaggerConfig).then(function(swaggerExpress) {
            swaggerExpress.register(app);    
        }));
        
        promises.push(swaggerCreateAsync(redfishConfig).then(function(swaggerExpress) {
            var swaggerUi = require('swagger-tools/middleware/swagger-ui');
            app.use(swaggerUi(swaggerExpress.runner.swagger,{ swaggerUi: '/redfish/v1/swagger-ui' }));
            swaggerExpress.register(app);
        }));

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

        // UI Directory
        app.use('/ui', express.static('./static/web-ui'));

        // Mount API Routers
        app.use('/api/common', router);
        app.use('/api/current', router);
        app.use('/api/1.1', router);

        var httpProxies = configuration.get('httpProxies');
        if (httpProxies && _.isArray(httpProxies)) {
            _.forEach(httpProxies, createHttpProxy.bind(this, app));
        }

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

    /**
     * Creates http proxy
     * @private
     * @param {Object} httpProxy - proxy parameters
     * @returns
     */
    function createHttpProxy(app, httpProxy){
        try {
            var localPath = httpProxy.localPath || '/',
                remotePath = httpProxy.remotePath || '/',
                serverAddr = httpProxy.server;
            app.use(localPath, proxy(serverAddr, {
                forwardPath: function (req, res) {
                    return path.join(remotePath, require('url').parse(req.url).path);
                },
                decorateRequest: function (req) {
                    //For HTTPS access
                    req.rejectUnauthorized = false;
                }
            }));
            logger.info('Create proxy succeeded',
                {
                    localPath: localPath,
                    remotePath: remotePath,
                    serverAddress: serverAddr
                });
        }
        catch(e){
            logger.error('Create proxy failed',
                {
                    message: e.message,
                    parameter: httpProxy
                }
            );
        }
    }

    return app;
}
