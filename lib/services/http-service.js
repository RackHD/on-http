// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di');
var express = require('express');
var cors = require('cors');
var onFinished = require('on-finished');
var http = require('http');
var https = require('https');
var fs = require('fs');
var proxyMiddleware = require('http-proxy-middleware');
var path = require('path');
var bodyParser = require('body-parser');

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
        'Auth.Services',
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
    authService,
    injector
) {
    var logger = Logger.initialize(httpServiceFactory);

    function HttpService(endpoint) {
        this.app = express();
        this.endpoint = this._parseEndpoint(endpoint);
        this.server = null;
        authService.init();
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

        return new Promise(function(resolve, reject) {
            return self.server.listen(
                self.endpoint.port, 
                self.endpoint.address, 
                function(error) {
                    return error ? reject(error) : resolve();
            });
        });
    };

    HttpService.prototype.stop = function() {
        wss.stop();
        var self = this;
        return new Promise(function(resolve, reject) {
            return self.server.close( 
                function(error) {
                    return error ? reject(error) : resolve();
            });
        });
    };

    HttpService.prototype.createSwagger = function() {
        var app = this.app;
        var endpoint = this.endpoint;
        //Swagger support
        var swaggerConfig = {
            appRoot: path.resolve(__dirname, '../../'),
            configDir: path.resolve(__dirname, '../../swagger_config'),
            swagger: path.resolve(__dirname, '../../static/' + endpoint.yamlName),
            authEnabled: this.endpoint.authEnabled
        };

        var redfishConfig = {
            appRoot: path.resolve(__dirname, '../../'),
            configDir: path.resolve(__dirname, '../../swagger_config'),
            swagger: path.resolve(__dirname, '../../static/redfish.yaml'),
            authEnabled: this.endpoint.authEnabled
        };

        //todo: make this configurable vis endpoint
        var sbSwaggerConfig = {
            appRoot: path.resolve(__dirname, '../../'),
            configDir: path.resolve(__dirname, '../../swagger_config'),
            swagger: path.resolve(__dirname, '../../static/monorail-2.0-sb.yaml')
        };

        var swaggerCreateAsync = Promise.promisify(swagger.create);

        var apiV2 = swaggerCreateAsync(swaggerConfig).then(function(swaggerExpress) {
            return swaggerExpress.register(app);
        });

        var sbApiV2 = swaggerCreateAsync(sbSwaggerConfig).then(function(swaggerExpress) {
            return swaggerExpress.register(app);
        });

        var redfish = swaggerCreateAsync(redfishConfig).then(function(swaggerExpress) {
            var swaggerUi = require('swagger-tools/middleware/swagger-ui');
            app.use(
                swaggerUi(swaggerExpress.runner.swagger, {
                    swaggerUi: '/swagger-ui',
                    swaggerUiDir: path.resolve(__dirname, '../../static/swagger-ui')
                })
            );
            return swaggerExpress.register(app);
        });

        return Promise.all([apiV2, sbApiV2, redfish]);
    };

    HttpService.prototype._setup =  function() {
        var app = this.app;
        var endpoint = this.endpoint;

        // CORS Support
        app.use(cors());
        app.options('*', cors());

        // Imaging Event Middleware
        app.use(httpEventMiddleware);

        // Override default static directory with sku specific handlers
        app.use(function(req, res, next) {
            skuService.static(req, res, next);
        });

        // Parse request body. Limit set to 50MB
        app.use(bodyParser.json({limit: '50mb'}));

        // Default Static Directory
        app.use(express.static('./static/http'));
        app.use('/upnp', express.static('./static/upnp'));

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

        // Initialize authentication always
        app.use(authService.getPassportMidware());

        // Only apply authentication routes if auth is enabled
        if (endpoint.authEnabled) {
            // mount ./login only when authentication is enabled
            app.use(injector.get('Http.Api.Login'));
            app.all('/api/1.1/*', authService.authMiddlewareJwt.bind(authService));
            app.all('/api/common/*', authService.authMiddlewareJwt.bind(authService));
            app.all('/api/current/*', authService.authMiddlewareJwt.bind(authService));
        }

        // Mount API Routers
        _.forEach(endpoint.routers, function(routerName) {
            var router;
            try {
                router = injector.get(routerName);
            } catch (e){
                logger.error('Cound not found router named : ' + routerName, { error: e });
                return;
            }

            router.mount();
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
            routers: parseRouterNames(endpoint.routers),
            yamlName: endpoint.yamlName || 'monorail-2.0.yaml'
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
            return skuService.setupScope(nodeId);
        }).then(function(scope) {
            res.locals.scope = scope;
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
        var sep = path.sep; //The platform-specific file separator. '\\' or '/'
        try {
            var localPath = httpProxy.localPath || sep,
                remotePath = httpProxy.remotePath || sep,
                serverAddr = httpProxy.server;

            //localPath & remotePath should always starts with /
            if (!localPath.startsWith(sep)) {
                localPath = sep + localPath;
            }
            if (!remotePath.startsWith(sep)) {
                remotePath = sep + remotePath;
            }

            //localPath & remotePath should both ends with / or not, otherwise the pathRewrite will
            //not work well
            if (remotePath.endsWith(sep) && !localPath.endsWith(sep)) {
                localPath = localPath + sep;
            }
            else if (!remotePath.endsWith(sep) && localPath.endsWith(sep)) {
                remotePath = remotePath + sep;
            }

            var pathRewrite = {};
            pathRewrite['^' + localPath] = remotePath; //^ is a symbol in regex, means beginning

            var proxy = proxyMiddleware(localPath, {
                target: serverAddr,
                changeOrigin: true, //needed for virtual hosted sites. Without this, proxy to
                                    //external sites will fail and are blocked by corp's internal
                                    //firewall
                pathRewrite: pathRewrite,
                secure: false //ignore verify SSL Certs, so proxy works for https
            });
            app.use(proxy);
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
