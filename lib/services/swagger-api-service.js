// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di');
var util = require('util');
var path = require('path');

module.exports = swaggerFactory;

di.annotate(swaggerFactory, new di.Provide('Http.Services.Swagger'));
di.annotate(swaggerFactory,
    new di.Inject(
            'Promise',
            'Errors',
            '_',
            di.Injector,
            'Views',
            'Assert',
            'Http.Api.Services.Schema',
            'Services.Configuration',
            'Services.Environment',
            'Services.Lookup',
            'Constants',
            'ejs'
        )
    );

function swaggerFactory(
    Promise,
    Errors,
    _,
    injector,
    views,
    assert,
    schemaApiService,
    config,
    env,
    lookupService,
    Constants,
    ejs
) {
    function _processError(err) {
        if (!util.isError(err) && err instanceof Object) {
            var status = err.status;
            var message = (err instanceof Error) ? err : err.message;
            err = new Error(message);
            if (status) { err.status = status; }
        }
        return err;
    }

    function _parseQuery(req) {
        req.swagger.query = _(req.swagger.params)
        .pick(function(param) {
            if (param.parameterObject) {
                if (param.parameterObject.type === 'array' && param.value) {
                    return param.parameterObject.in === 'query';
                } else {
                    return param.parameterObject.in === 'query' &&
                        param.parameterObject.type === typeof(param.value);
                }
            }
                return false;
        })
        .mapValues(function(param) {
            req.query = _(req.query).omit(param.parameterObject.definition.name).value();
            if (typeof(param.value) === 'string' && param.value.match(/\+/)) {
                return param.value.split(/\+/);
            }
            return param.value;
        }).value();
    }

    function swaggerController(options, callback) {
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        return function(req, res, next) {
            req.swagger.options = options;
            return Promise.try(function() {
                _parseQuery(req);
                return callback(req, res);
            }).then(function(result) {
                if (!res.headersSent && result) {
                    if (_.isArray(result)) {
                        res.body = result.map(function(element) {
                            return element.toJSON ? element.toJSON() : element;
                        });
                    } else {
                        res.body = result.toJSON ? result.toJSON() : result;
                    }
                }
                if (!res.headersSent) {
                    next();
                }
            }).catch(function(err) {
                next(_processError(err));
            });
        };
    }

    function swaggerDeserializer(injectableDeserializer) {
        var Deserializer = injector.get(injectableDeserializer);

        return function(req, res, next) {
            var deserializer = new Deserializer();
            return Promise.resolve().then(function() {
                if (req.method === 'PATCH') {
                    return deserializer.validatePartial(req.body);
                }
                return deserializer.validate(req.body);
            }).then(function(validated) {
                return deserializer.deserialize(validated);
            }).then(function(deserialized) {
                req.body = deserialized;
                next();
            }).catch(function(err) {
                next(_processError(err));
            });
        };
    }

    function swaggerSerializer(injectableSerializer) {
        var Serializer = injector.get(injectableSerializer);

        function serialize(data) {
            var serializer = new Serializer();
            return Promise.resolve().then(function() {
                return serializer.serialize(data);
            }).then(function(serialized) {
                return serializer.validateAsModel(serialized);
            }).then(function(validated) {
                return validated;
            });
        }

        return function(req, res, next) {
            var serialized;

            if (_.isArray(res.body)) {
                serialized = Promise.map(res.body, function(item) {
                    return serialize(item);
                });
            } else {
                serialized = serialize(res.body);
            }

            return serialized.then(function(validated) {
                res.body = validated;
                next();
            }).catch(function(err) {
                next(_processError(err));
            });
        };
    }

    function _render(viewName, req, res) {
        var options;
        var contentType;

        return Promise.try(function() {
            assert.optionalString(viewName);
            assert.object(req);
            assert.object(res);
        })
        .then(function() {
            options = {
                basepath: req.swagger.operation.api.basePath,
                Constants: Constants,
                _: _,
                filename:  Constants.Views.Directory
            };
        })
        .then(function() {
            if (_.isEmpty(res.body)) {
                // Skip rendering and do not set content-type.
                return res.body;
            } else if (!viewName) {
                // Skip rendering and set content-type
                contentType = 'text/plain';
                return res.body;
            } else if (_.isArray(res.body)) {
                contentType = 'application/json';

                // Use ejs render directly to avoid repeatedly loading the same view
                return Promise.try(function() {
                    return views.get(viewName);
                })
                .then(function(view) {
                    return Promise.map(res.body, function(element) {
                        return ejs.render(view.contents, _.merge(element, options));
                    })
                })
                .then(function(collection) {
                    return views.render('collection.2.0.json', { collection: collection });
                });
            } else {
                contentType = 'application/json';
                return views.render(viewName, _.merge(res.body, options));
            }
        })
        .then(function(data) {
            if (contentType) {
                res.set('Content-Type', contentType);
                if (contentType === 'application/json') {
                    var parsed;
                    // Parse JSON to validate rendered output and remove
                    // unnecessary whitespace from response.
                    parsed = JSON.parse(data);
                    return JSON.stringify(parsed);
                }
            }
            return data;
        })
        .catch(function(err) {
            throw new Errors.ViewRenderError(err.message);
        });
    }

    function swaggerRenderer(req, res, viewName, next) {
        return Promise.try(function() {
            assert.ok(!res.headersSent, 'headers have already been sent');
            return [ viewName, req, res ];
        })
        .spread(_render)
        .tap(function() {
            // Set appropriate HTTP status.
            if (_.isEmpty(res.body) && req.swagger.options.send204OnEmpty) {
                res.status(204);
            } else {
                res.status(req.swagger.options.success || 200);
            }
        })
        .then(res.send.bind(res))
        .catch(function(err) {
            if (res.locals.errorStatus) {
                next();
            } else {
                next(_processError(err));
            }

        });
    }

    function swaggerValidator() {
        var namespace = '/api/2.0/schemas/';
        var schemaPath = path.resolve(__dirname, '../../static/schemas/2.0');
        var namespace1Added = schemaApiService.addNamespace(schemaPath, namespace);

        namespace = '/api/2.0/obms/definitions/';
        schemaPath = path.resolve(__dirname, '../../static/schemas/obms');
        var namespace2Added = schemaApiService.addNamespace(schemaPath, namespace);

        var namespacesAdded = Promise.all([namespace1Added, namespace2Added]);

        return function(schemaName, data, next) {
            namespacesAdded.then(function () {
                if (schemaName) {
                    return schemaApiService.validate(data, schemaName)
                        .then(function (validationResults) {
                            if (validationResults.error) {
                                throw new Error(validationResults.error);
                            }
                            next();
                        }).catch(function (err) {
                            next(_processError(err));
                        });
                } else {
                    next();
                }
            });
        };
    }

    function makeRenderableOptions(req, res, context, ignoreLookup) {
        var scope = res.locals.scope;
        var apiServer = util.format('http://%s:%d',
            config.get('apiServerAddress'),
            config.get('apiServerPort')
        );
        var baseUri = util.format('%s/%s', apiServer, req.swagger.operation.api.basePath);
        context = context || {};

        return Promise.props({
            server: config.get('apiServerAddress', '10.1.1.1'),
            port: config.get('apiServerPort', 80),
            ipaddress: res.locals.ipAddress,
            netmask: config.get('dhcpSubnetMask', '255.255.255.0'),
            gateway: config.get('dhcpGateway', '10.1.1.1'),
            macaddress: ignoreLookup ?
                '' : lookupService.ipAddressToMacAddress(res.locals.ipAddress),
            sku: env.get('config', {}, [ scope[0] ]),
            env: env.get('config', {}, scope),
            // Build structure that mimics the task renderContext
            api: {
                server: apiServer,
                base: baseUri,
                files: baseUri + '/files',
                nodes: baseUri + '/nodes'
            },
            context: context,
            nodeId: context.target
        });
    }

    return {
        controller: swaggerController,
        deserializer: swaggerDeserializer,
        serializer: swaggerSerializer,
        renderer: swaggerRenderer,
        validator: swaggerValidator,
        makeRenderableOptions: makeRenderableOptions
    };
}
