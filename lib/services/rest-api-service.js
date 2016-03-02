// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di');
var bodyParser = require('body-parser');
var http = require('http');

module.exports = restFactory;

di.annotate(restFactory, new di.Provide('Http.Services.RestApi'));
di.annotate(restFactory,
    new di.Inject(
            'Serializable',
            'Promise',
            '_',
            'Assert',
            'Util',
            'Errors',
            'ErrorEvent',
            'Logger',
            di.Injector
        )
    );

function restFactory(
    Serializable,
    Promise,
    _,
    assert,
    util,
    Errors,
    ErrorEvent,
    Logger,
    injector
) {

    var logger = Logger.initialize(restFactory);

    var NO_CONTENT_STATUS = 204;
    var BAD_REQUEST_STATUS = 400;
    var ERROR_STATUS = 500;

    /**
     * Convenience constructor for HTTP errors. These errors can be thrown or used as a rejected
     * value from any serializer, deserializer or callback to {@link rest}.
     *
     * @param {number} status HTTP status code to send.
     * @param {string} [message] Error text to be presented to the user.
     * @param {*} [context] Additional error metadata.
     */

    function HttpError(status, message, context) {
        HttpError.super_.call(this, message, context);
        this.status = status;
    }

    util.inherits(HttpError, Errors.BaseError);

    /**
     * Middleware factory function for generic REST API services. Currently only supports JSON
     * input/output. There are five steps to the middleware:
     *
     * - parse - Parse JSON input and throw errors if parsing fails
     * - deserialize - Validate and transform the input data
     * - exec - Run the provided callback and capture its output
     * - serialize - Validate and transform the output data
     * - render - Stringify JSON output and write out the request
     *
     * Valid options:
     *
     * - isArray {boolean} - Set to true to have the serializer run as a map over an array of
     *                       objects. This will also cause the serializer to produce an error if
     *                       the callback function does not return an array.
     * - parseOptions {object} - Options to pass to JSON body parser.
     * - renderOptions {object} - Options to pass to render middleware. See {@link rest#render}.
     * - deserializer {function|string} - Deserializer function or injector string of deserializer
     *                                    class. See {@link rest#deserialize} and
     *                                    {@link rest#createDeserializeFunc}.
     * - serializer {function|string} - Serializer function or injector string of serializer class.
     *                                  See {@link rest#serialize} and
     *                                  {@link rest#createSerializeFunc}.
     *
     * @param {function} callback Callback that takes req and res parameters and has its return
     *                            value resolved as a promise. When the promise is resolved or
     *                            rejected, the value will be written out as the response body.
     * @param {object} [options] Options hash.
     * @returns {function[]} Middleware pipeline.
     */

    function rest(callback, options) {
        assert.func(callback, 'callback function is required');
        assert.optionalObject(options, 'options should be an optional object');

        options = options || {};

        var deserializer = options.deserializer;
        if (typeof deserializer === 'string') {
            deserializer = rest.createDeserializeFunc(injector.get(deserializer));
        }

        assert.optionalFunc(
            deserializer,
            'options.deserializer should be an optional function or injector string');

        var serializer = options.serializer;
        if (typeof serializer === 'string') {
            serializer = rest.createSerializeFunc(injector.get(serializer));
        }

        assert.optionalFunc(
            serializer,
            'options.serializer should be an optional function or injector string');

        var middleware = [
            rest.parse(options.parseOptions),
            rest.deserialize(deserializer),
            rest.exec(callback),
            options.isArray ?
                rest.serializeArray(serializer) :
                rest.serialize(serializer),
            rest.render(options.renderOptions),
            rest.handleError()
        ];

        return middleware;
    }

    /**
     * Parses JSON from the request body into req.body. Uses body-parser internally.
     * @param {object} options Options hash. Passed directly to body parser.json().
     * @returns {function} Middleware function.
     */

    rest.parse = function (options) {
        assert.optionalObject(options, 'options should be an optional object');
        options = options || {};

        var parser = bodyParser.json(options);
        return function parserMiddleware(req, res, next) {
            if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT') {
                var contentLength = parseInt(req.headers['content-length'], 10);

                if (contentLength) {
                    if (!req.is('json')) {
                        next(new HttpError(BAD_REQUEST_STATUS,
                                           'Content-Type must be application/json'));
                                           return;
                    }
                    parser(req, req, function (err) {
                        if (err) {
                            err.message = 'Error parsing JSON: ' + err.message;
                        }
                        next(err);
                    });
                    return;
                }
            }
            next();
        };
    };

    /**
     * Takes a promise-returning callback and returns a middleware function that calls next() when
     * the promise resolves.
     * @param {function} callback Callback that takes req and res parameters and has its return
     *                            value resolved as a promise. When the promise is resolved or
     *                            rejected, the next() function will be called.
     * @returns {function} Middleware function.
     */

    rest.async = function (callback) {
        assert.func(callback, 'callback should be a function');
        return function asyncMiddleware(req, res, next) {
            Promise.resolve().then(function () {
                return callback(req, res);
            }).then(function () {
                next();
            }).catch(function (err) {
                next(err || new Error());
            });
        };
    };

    /**
     * Runs a deserializer function on req.body.
     * @param {function} deserializer Callback that takes an object to be deserialized and returns
     *                                the deserialized value, or a promise resolved to the
     *                                deserialized value.
     * @returns {function} Middleware function.
     */

    rest.deserialize = function (deserializer) {
        assert.optionalFunc(deserializer, 'deserializer should be an optional function');
        return rest.async(function deserializeMiddleware(req) {
            if (deserializer) {
                var options = {
                    method: req.method
                };
                return Promise.resolve(deserializer(req.body, options))
                .then(function (value) {
                    req.originalBody = req.body;
                    req.body = value;
                }).catch(function (err) {
                    // Need to check to string here since we wrap errors with new Error() to support
                    // util.isError checks by swagger going forward.
                    if (err && err.toString().contains(Errors.ValidationError.name)) {
                        err.status = BAD_REQUEST_STATUS;
                    } else if (err && err.toString().contains(Errors.SchemaError.name)) {
                        err.status = BAD_REQUEST_STATUS;
                    }
                    throw err;
                });
            }
        });
    };

    /**
     * Takes a promise-returning callback and sets the resolved value to res.body, then calls
     * next().
     * @param {function} callback Callback that takes req and res parameters and returns the value
     *                            to output in the response body, or a promise resolved to the
     *                            desired output.
     * @returns {function} Middleware function.
     */

    rest.exec = function (callback) {
        assert.func(callback, 'callback should be a function');
        return rest.async(function execMiddleware(req, res) {
            return Promise.resolve(callback(req, res))
            .then(function (value) {
                res.body = value;
            });
        });
    };

    /**
     * Runs a serializer function on res.body.
     * @param {function} serializer Callback that takes an object to be serialized and returns
     *                              the serialized value, or a promise resolved to the serialized
     *                              value.
     * @returns {function} Middleware function.
     */

    rest.serialize = function (serializer) {
        assert.optionalFunc(serializer, 'serializer should be an optional function');
        return rest.async(function serializeMiddleware(req, res) {
            if (serializer) {
                return Promise.resolve(serializer(res.body))
                .then(function (value) {
                    res.originalBody = res.body;
                    res.body = value;
                });
            }
            return res.body;
        });
    };

    /**
     * Checks that res.body is an array, then runs a serializer function on each element.
     * @param {function} serializer Callback that takes an object to be serialized and returns
     *                              the serialized value, or a promise resolved to the serialized
     *                              value.
     * @returns {function} Middleware function.
     */

    rest.serializeArray = function (serializer) {
        return rest.serialize(function (data) {
            assert.ok(Array.isArray(data), 'output should be an array');
            if (serializer) {
                return Promise.all(_.map(data, function (record) {
                    return serializer(record);
                }));
            }
            return data;
        });
    };

    /**
     * Writes out the content of res.body as JSON. Valid options:
     *
     * - success [integer] - Response code to send on success.
     *
     * @param {object} options Options hash.
     * @returns {function} Middleware function.
     */

    rest.render = function (options) {
        assert.optionalObject(options, 'options should be an optional object');
        options = options || {};

        assert.optionalNumber(options.success, 'options.success should be an optional number');
        if (options.success) {
            assert.isIn(options.success.toString(), _.keys(http.STATUS_CODES));
        }

        return function renderMiddleware(req, res, next) {
            if (!res.headersSent) {
                if (res.body === null || res.body === undefined) {
                    res.status(NO_CONTENT_STATUS);
                    res.end();
                } else {
                    if (options.success) {
                        res.status(options.success);
                    }
                    res.json(res.body);
                }
            }
            next();
        };
    };

    /**
     * Catches errors and writes them out as JSON.
     * @returns {function} Middleware function.
     */

    rest.handleError = function () {
        return function handleErrorMiddleware(err, req, res, next) {
            // TODO - implement custom error type serializers
            if (err instanceof Error || err instanceof ErrorEvent) {
                var message = err.message || http.STATUS_CODES[err.status] || 'Unspecified Error';
                logger.error(message, {
                    error: err,
                    path: req.path
                });

                if (!err.status || err.status === ERROR_STATUS) {
                    res.status(ERROR_STATUS);
                    res.json({
                        message: message
                    });
                } else {
                    res.status(err.status);
                    res.json({
                        message: message
                    });
                }
            } else if (typeof err === 'string') {
                res.status(ERROR_STATUS);
                res.json({
                    message: err
                });
            } else {
                res.status(ERROR_STATUS);
                res.json(err);
            }

            next(err);
        };
    };

    /**
     * Takes a deserializer class and turns it into a promise returning function. The deserializer
     * class must be new-able and must have validate and deserialize methods on its prototype. These
     * methods should both take one argument (the object to transform) and should return a
     * value or a promise. The result from the deserialize function will be used as the final
     * resolved value.
     * @param {Deserializer} Deserializer Deserializer constructor.
     * @returns {function} Promise-returning deserializer function.
     */

    rest.createDeserializeFunc = function (Deserializer) {
        assert.func(Deserializer, 'deserializer should be a class');
        assert.ok(Deserializer.prototype instanceof Serializable,
                 'Deserializer is not an instance of Serializable');

        return function (data, options) {
            var deserializer = new Deserializer();
            return Promise.resolve().then(function () {
                if (options.method === 'PATCH') {
                    return deserializer.validatePartial(data);
                }
                return deserializer.validate(data);
            }).then(function () {
                return deserializer.deserialize(data);
            });
        };
    };

    /**
     * Takes a serializer class and turns it into a promise returning function. The serializer
     * class must be new-able and must have validate and serialize methods on its prototype. These
     * methods should both take one argument (the object to transform) and should return a
     * value or a promise. The result from the serialize function will be used as the final
     * resolved value.
     * @param {Serializer} Serializer Serializer constructor.
     * @returns {function} Promise-returning deserializer function.
     */

    rest.createSerializeFunc = function (Serializer) {
        assert.func(Serializer, 'serializer should be a class');

        return function (data) {
            var serializer = new Serializer();

            assert.ok(serializer instanceof Serializable,
                'serializer is not an instance of Serializable');

            return Promise.resolve().then(function () {
                return serializer.serialize(data);
            }).then(function (serialized) {
                return serializer.validateAsModel(serialized).then(function () {
                    return serialized;
                });
            });
        };
    };

    rest.HttpError = HttpError;

    return rest;
}
