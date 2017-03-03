// Copyright 2017, Dell EMC, Inc.

'use strict';

var di = require('di');

module.exports = hookApiServiceFactory;
di.annotate(hookApiServiceFactory, new di.Provide('Http.Services.Api.Hooks'));
di.annotate(hookApiServiceFactory,
    new di.Inject(
        'Services.Waterline',
        'Logger',
        '_',
        'Errors',
        'Assert',
        'Promise'
    )
);
function hookApiServiceFactory(
    waterline,
    Logger,
    _,
    Errors,
    assert,
    Promise
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
     * Get hook by identifier
     * @return {Promise}
     */
    HooksApiService.prototype.getHookById = function (id) {
        return waterline.hooks.findOne({id: id});
    };
    /**
     * Create new hooks
     * @param {Object} body HTTP request body
     * @return
     */
    HooksApiService.prototype.createHook = function(body) {
        return Promise.try(function(){
            assert.isURL(body.url, {protocols: ['http', 'https']});
        })
        .then(function(){
            return waterline.hooks.findOne({url: body.url});
        })
        .then(function(entry){
            if(_.isEmpty(entry)) {
                return waterline.hooks.create(body);
            } else {
                var err = new Errors.BaseError('duplicate hook found');
                err.status = 409;
                throw err;
            }
        });
    };

    /**
     * Delete hook by identifier
     * @param {String} id hook identifier
     * @return
     */
    HooksApiService.prototype.deleteHookById = function(id) {
        return waterline.hooks.destroyByIdentifier(id);
    };

    /**
     * Update hook by identifier
     * @param {String} id hook identifier
     * @param {Object} body hook body to be updated
     * @return
     */
    HooksApiService.prototype.updateHookById = function(id, body) {
        return waterline.hooks.updateByIdentifier(id, body);
    };

    return new HooksApiService();
}
