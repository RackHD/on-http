// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di');

module.exports = hookApiServiceFactory;
di.annotate(hookApiServiceFactory, new di.Provide('Http.Services.Api.Hooks'));
di.annotate(hookApiServiceFactory,
    new di.Inject(
        'Services.Waterline',
        'Logger',
        '_',
        'Errors'
    )
);
function hookApiServiceFactory(
    waterline,
    Logger,
    _,
    Errors
) {
    var logger = Logger.initialize(hookApiServiceFactory);
    function HooksApiService() {
    }

    /**
     * Get hooks
     * @return {Promise}
     */
    HooksApiService.prototype.getHooks = function (query) {
        return waterline.hooks.find(query);
    };

    /**
     * Create new hooks
     * @param {Object} [req] HTTP request
     * @param {Object} [res] HTTP response
     * @return
     */
    HooksApiService.prototype.createHook = function(body) {
        var self = this;
        return waterline.hooks.findOne({url: body.url})
        .then(function(entry){
            if(_.isEmpty(entry)) {
                return waterline.hooks.create(body)
                .then(function(hook){
                    return hook;
                });
            } else if (body.filters && !_.isEqual(body.filters, entry.filters)) {
                var filters = entry.filters || [];
                filters = _.uniq(filters.concat(body.filters));
                entry.filters = filters;
                return waterline.hooks.update(entry)
                .then(function(){
                    return entry;
                });
            } else {
                var err = new Errors.BaseError('duplicate hook found');
                err.status = 409;
                throw err;
            }
        });
    };

    /**
     * Delete hook by identifier
     * @param {String} id hook idenfier
     * @return
     */
    HooksApiService.prototype.deleteHookById = function(id) {
        var self = this;
        return waterline.hooks.destroyByIdentifier(id);
    };

    /**
     * Update hook by identifier
     * @param {String} id hook idenfier
     * @param {Object} body hook body to be updated
     * @return
     */
    HooksApiService.prototype.updateHookById = function(id, body) {
        var self = this;
        return waterline.hooks.updateByIdentifier(id, body)
        .then(function(hook){
            return hook;
        });
    };

    return new HooksApiService();
}
