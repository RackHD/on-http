// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node: true */
'use strict';

require('es6-shim');

var di = require('di'),
    ejs = require('ejs'),
    _ = require('lodash');

module.exports = CommonApiPresenterFactory;

di.annotate(CommonApiPresenterFactory, new di.Provide('common-api-presenter'));
di.annotate(CommonApiPresenterFactory,
    new di.Inject(
        'Constants',
        'Services.Configuration',
        'Logger',
        'Q',
        'Services.Lookup',
        'Services.Profile',
        'Services.Template'
    )
);

/**
 * CommonApiPresenterFactory provides the presenter factory function.
 * @private
 * @param  {configuration} configuration  NConf Configuration Object.
 * @param  {logger} logger Logger Service Object.
 * @param {LookupService} lookupService Instance of the LookupService
 * @return {function}        presenter factory function.
 */
function CommonApiPresenterFactory(
    constants,
    configuration,
    Logger,
    Q,
    lookupService,
    profileService,
    templateService
) {
    var logger = Logger.initialize(CommonApiPresenterFactory);

    // TODO: stolen from http-service could stand to be a re-usable helper.
    /**
     * Get remote address of the client.
     * @private
     * @param {req} req from express
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

    presenter.use = function serializer(name, func) {
        if (presenter._serializers.has(name)) {
            throw new Error('Serializer for ' + name + ' already registered');
        }
        presenter._serializers.set(name, func);
    };

    // Map() comes from es6-shim
    presenter._serializers = new Map();  /* jshint ignore: line */

    presenter.serialize = function serialize(value, options) {
        if (typeof options === 'string') {
            options = {
                serializer: options
            };
        } else if (!options) {
            options = {};
        }
        return Q.resolve(value).then(function (value) {
            var serializer = null;

            if (options.serializer) {
                serializer = presenter._serializers.get(options.serializer);
            } else if (value && value.constructor) {
                serializer = presenter._serializers.get(value.constructor.name);
            }
            if (serializer) {
                return serializer(value, options);
            }
            return value;
        });
    };

    presenter.middleware = function presenterMiddleware(callback, options) {
        options = options || {};

        return function present(req, res, next) {
            var value;
            if (typeof callback === 'function') {
                try {
                    value = callback(req, res, next);
                } catch (err) {
                    return presenter(req, res).render(Q.reject(err));
                }
            } else {
                value = callback;
            }

            return Q.resolve(value).then(function (result) {
                return presenter.serialize(result, {
                    serializer: (typeof options === 'string') ? options : options.serializer,
                    version: options.version || req.headers[constants.API_VERSION_HEADER]
                });
            }).then(function (result) {
                return presenter(req, res).render(result, options.success || res.statusCode);
            }).catch(function (err) {
                return presenter(req, res).render(Q.reject(err));
            });
        };
    };

    /**
     * presenter factory method.
     * @param  {Request} req Express Request Object.
     * @param  {Response} res Express Response Object.
     * @return {CommonApiPresenter}     CommonApiPresenter
     */
    function presenter (req, res) {
        /**
         * CommonApiPresenter converts fulfilled promises into their proper
         * ExpressJS responses.
         * @param {Request} req Express Request Object.
         * @param {Response} res Express Response Object.
         * @constructor
         */
        function CommonApiPresenter (req, res) {
            this.req = req;
            this.res = res;
        }

        /**
         * render
         * @param  {Promise} promise A promise which is fulfilled with Javascript
         * Objects to render as JSON.
         * @param  {Integer} status  Optional HTTP status code.
         */
        CommonApiPresenter.prototype.render = function (promise, status) {
            var self = this;

            status = status || 200;

            return Q.resolve(promise).then(function (result) {
                if (result === undefined || result === null) {
                    self.renderNotFound();
                } else {
                    self.res.status(status).json(result);
                }
            })
            .catch(function (err) {
                self.renderError(err);
            });
        };

        CommonApiPresenter.prototype.renderPlain = function (promise, status) {
            var self = this;

            status = status || 200;

            return Q.resolve(promise).then(function (result) {
                if (result === undefined || result === null) {
                    self.renderNotFound();
                } else {
                    self.res.status(status).send(result);
                }
            })
            .catch(function (err) {
                self.renderError(err);
            });
        };

        /**
         * renderError
         * @param  {Error|String} error An error object or string representing
         * the error to render.
         */
        CommonApiPresenter.prototype.renderError = function (error, options, status) {
            status = status || error.status || 500;

            logger.error(error.message, {
                error: error,
                path: this.req.path
            });

            this.res.status(status).json(error);
        };

        /**
         * renderNotFound
         */
        CommonApiPresenter.prototype.renderNotFound = function () {
            this.res.status(404).json({ error: 'Not Found'});
        };

        /**
         * renderTemplate
         * @param  {string} template The name of the desired template.
         * to render.
         * @param  {Object} [options] An optional object to use for rendering via
         * the EJS renderer.
         * @param  {Integer} [status]  An optional HTTP status code.
         */
        CommonApiPresenter.prototype.renderTemplate = function (name, options, status) {
            var self = this;

            options = options || {};
            status = status || 200;

            var promises = [
                lookupService.ipAddressToMacAddress(remoteAddress(req)),
                templateService.get(name)
            ];

            Q.all(promises).spread(function (macaddress, template) {
                var output;

                try {
                    output = ejs.render(
                        template.contents,
                        _.merge(
                            options,
                            {
                                server: configuration.get('server'),
                                port: configuration.get('httpport'),
                                ipaddress: remoteAddress(req),
                                netmask: configuration.get('subnetmask'),
                                gateway: configuration.get('server'),
                                macaddress: macaddress
                            }
                        )
                    );
                } catch (err) {
                    return self.renderError(err, options);
                }

                self.res.status(status).send(output);
            })
            .fail(function (err) {
                self.renderError(err);
            });
        };

        /**
         * renderProfile
         * @param  {string} profile The name of the desired profile.
         * to render.
         * @param  {Object} options An optional object to use for rendering via
         * the EJS renderer.
         * @param  {Integer} status  An optional HTTP status code.
         */
        CommonApiPresenter.prototype.renderProfile = function (profile, options, status) {
            var self = this;

            options = options || {};
            status = status || 200;

            var promises = [
                lookupService.ipAddressToMacAddress(remoteAddress(req)),
                profileService.get(profile, true)
            ];

            if (profile.endsWith('.ipxe')) {
                promises.push(profileService.get('boilerplate.ipxe', true));
                promises.push(profileService.get('error.ipxe', true));
            } else if (profile.endsWith('.zt')) {
                // There is no boilerplate for .zt profiles at the moment, but
                // preserve the function signature for .spread below to work
                // with .ipxe boilerplate and in case we ever want to add boilerplate.
                promises.push(Q.resolve(''));
                promises.push(profileService.get('error.zt', true));
            }

            Q.all(promises).spread(
                function (macaddress, contents, boilerPlate, errorPlate) {
                    var output = null;

                    options = _.merge(
                        options,
                        {
                            server: configuration.get('server'),
                            port: configuration.get('httpport'),
                            ipaddress: remoteAddress(req),
                            netmask: configuration.get('subnetmask'),
                            gateway: configuration.get('server'),
                            macaddress: macaddress
                        }
                    );

                    try {
                        // Render the requested profile + options.
                        output = ejs.render(boilerPlate + contents, options);
                    } catch (err) {
                        // Render error we'll try to render the error profile + options.
                        try {
                            output = ejs.render(
                                boilerPlate + errorPlate,
                                _.merge(options, { error: err.message })
                            );
                        } catch (terrible) {
                            // If we failed to render the error then we've got larger problems.

                            logger.error('Unable to render error template.', {
                                macaddress: macaddress,
                                error: terrible
                            });

                            return Q.reject(terrible);
                        }
                    }

                    self.res.status(status).send(output);
                }
            )
            .fail(function (err) {
                self.renderError(err);
            });
        };

        return new CommonApiPresenter(req, res);
    }

    return presenter;
}
