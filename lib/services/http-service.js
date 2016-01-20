// Copyright 2015, EMC, Inc.

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
        'swagger',
        'Logger',
        'Promise',
        'Events',
        'Errors',
        'Services.WebSocket',
        'Http.Services.SkuPack',
        '_',
        di.Injector
    )
);

/**
 * Factory that creates the express http service
 * @private
 * @param {Protocol.Events} eventsProtocol
 * @param {Services.Configuration} configuration
 * @param {Services.Lookup} lokupService
 * @param swagger
 * @param Logger
 * @param Q
 * @param {Events} events
 * @param Errors
 * @param {Services.WebSocket} wss
 * @param injector
 * @returns {function} HttpService constructor
 */
function httpServiceFactory(
    eventsProtocol,
    configuration,
    lookupService,
    swagger,
    Logger,
    Promise,
    events,
    Errors,
    wss,
    skuService,
    _,
    injector
) {
    var logger = Logger.initialize(httpServiceFactory);

    function HttpService(endpoint) {
        this.app = express();
        this.endpoint = this._parseEndpoint(endpoint);
        this.server = null;
        this._setup();
    }

    HttpService.prototype.start = function() {
        var self = this;
        // Create Http Proxy
        if (this.endpoint.proxiesEnabled) {
            var httpProxies = configuration.get('httpProxies');
            if (httpProxies && _.isArray(httpProxies)) {
                _.forEach(httpProxies, createHttpProxy.bind(this, self.app));
            }
        }

        if (this.endpoint.httpsEnabled) {
            this.server = https.createServer(this.httpsOptions, this.app);

            wss.start(this.server, {
                secureOptions: this.httpsOptions
            });
        } else {
            this.server = http.createServer(this.app);

            wss.start(this.server);
        }

        this.server.on('close', function() {
            logger.info('Server Closing.');
        });

        return this.server.listen(this.endpoint.port, this.endpoint.address);
    };

    HttpService.prototype.stop = function() {
        wss.stop();
        return this.server.close();
    };

    HttpService.prototype._setup =  function() {
        var app = this.app;
        var endpoint = this.endpoint;
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
        _.forEach(endpoint.routers, function(routerName) {
            var router;
            try {
                router = injector.get(routerName);
            } catch (e){
                logger.error('Cound not found router named : ' + routerName, { error: e });
                return;
            }
            //router.authEnabled = endpoint.authEnabled;
            router.endpoint = endpoint;
            // router.mount();
            app.use(/\/api\/(common|current|1\.1)/, router);
        });

        if (endpoint.httpsEnabled) {
            if (endpoint.httpsPfx) {
                this.httpsOptions = {
                    pfx: fs.readFileSync(endpoint.httpsPfx)
                };
            } else {
                this.httpsOptions = {
                    cert: fs.readFileSync(endpoint.httpsCert),
                    key: fs.readFileSync(endpoint.httpsKey)
                };
            }
        }
    };

    HttpService.prototype._parseEndpoint = function(endpoint) {
        function parseRouterNames (routers) {
            if (_.isEmpty(routers)) {
                return ['northbound-api-router', 'southbound-api-router'];
            } else {
                if (_.isString(routers)) {
                    return [routers];
                }
                if (_.isArray(routers) && _.all(routers, _.isString)) {
                    return routers;
                }
                return ['northbound-api-router', 'southbound-api-router'];
            }
        }

        return {
            address: endpoint.address || '0.0.0.0',
            port: endpoint.port || (endpoint.httpsEnabled ? 443 : 80),
            httpsEnabled : endpoint.httpsEnabled === true,
            httpsCert: endpoint.httpsCert || 'data/dev-cert.pem',
            httpsKey: endpoint.httpsKey || 'data/dev-key.pem',
            httpsPfx: endpoint.httpsPfx,
            proxiesEnabled: endpoint.proxiesEnabled === true,
            authEnabled: endpoint.authEnabled === true,
            routers: parseRouterNames(endpoint.routers)
        };
    };

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
                forwardPath: function (req) {
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

    return HttpService;
}
