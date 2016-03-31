// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di');

module.exports = configApiServiceFactory;
di.annotate(configApiServiceFactory, new di.Provide('Http.Services.Api.Config'));
di.annotate(configApiServiceFactory,
    new di.Inject(
        'Services.Configuration',
        '_'
    )
);
function configApiServiceFactory(
    configuration,
    _
) {
    function ConfigApiService() {
    }

    /**
     * Get server configuration
     * @return {Promise}
     */

    ConfigApiService.prototype.configGetAll = function () {
        // get the config

        return configuration.getAll();
    };

    /**
     * Set server configuration
     * @param {Object} [req] HTTP request
     * @param {Object} [res] HTTP response
     * @return {Promise}
     */

    ConfigApiService.prototype.configSet = function(config) {

        _.forOwn(config, function (value, key) {
            configuration.set(key, value);
        });

        return configuration.getAll();
    };

    return new ConfigApiService();
}
