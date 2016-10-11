// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di');

module.exports = pollerApiServiceFactory;
di.annotate(pollerApiServiceFactory, new di.Provide('Http.Services.Api.Pollers'));
di.annotate(pollerApiServiceFactory,
    new di.Inject(
        'Services.Waterline',
        'Protocol.Task',
        'Errors',
        '_',
        'Promise'
    )
);

function pollerApiServiceFactory(
    waterline,
    taskProtocol,
    Errors,
    _,
    Promise
) {

    function PollerApiService() {
    }

    var pollerLibrary = [
        {
            name: 'ipmi',
            node: true,
            config: [
                {
                    key: 'host',
                    type: 'string'
                },
                {
                    key: 'user',
                    type: 'string',
                    defaultsTo: 'admin'
                },
                {
                    key: 'password',
                    type: 'string',
                    defaultsTo: 'admin'
                },
                {
                    key: 'alerts',
                    type: 'json',
                    required: false
                }
            ]
        },
        {
            name: 'snmp',
            config: [
                {
                    key: 'host',
                    type: 'string',
                    required: true
                },
                {
                    key: 'communityString',
                    type: 'string',
                    required: true
                },
                {
                    key: 'extensionMibs',
                    type: 'string[]'
                }
            ]
        },
        {
            name: 'redfish',
            config: [
                {
                    key: 'uri',
                    type: 'string',
                    required: true
                },
                {
                    key: 'user',
                    type: 'string',
                    defaultsTo: 'admin'
                },
                {
                    key: 'password',
                    type: 'string',
                    defaultsTo: 'admin'
                }
            ]
        }
    ];

    PollerApiService.prototype.getPollerLib = function() {
        return pollerLibrary;
    };

    PollerApiService.prototype.getPollerLibById = function(id) {
        return _.detect(pollerLibrary, { name: id });
    };

    PollerApiService.prototype.getPollers = function(query, options) {
        options = options || {};

        return Promise.try(function() {
            query = waterline.workitems.find(query);

            if (options.skip) query.skip(options.skip);
            if (options.limit) query.limit(options.limit);

            return query;
        })
    };

    PollerApiService.prototype.getPollersById = function(id) {
        return waterline.workitems.needByIdentifier(id);
    };

    PollerApiService.prototype.postPollers = function(poller) {
        return waterline.workitems.create(poller);
    };


    PollerApiService.prototype.patchPollersById = function(id, poller) {
        return waterline.workitems.updateByIdentifier(id, poller);
    };


    PollerApiService.prototype.patchPollersByIdPause = function(id) {
        return waterline.workitems.updateByIdentifier(id, { paused: true });
    };


    PollerApiService.prototype.patchPollersByIdResume = function(id) {
        return waterline.workitems.updateByIdentifier(id, { paused: false });
    };

    PollerApiService.prototype.deletePollersById = function(id){
        return waterline.workitems.destroyByIdentifier(id);
    };

    PollerApiService.prototype.getPollersByIdData = function(id, options) {
        var self = this;
        return Promise.try(function() {
            return waterline.workitems.needByIdentifier(id);
        })
        .then(function() {
            return taskProtocol.requestPollerCache(id, options)
            .catch(function(err) {
                if (err.name !== 'NotFoundError') {
                    throw err;
                }
            });
        });
    };

    return new PollerApiService();
}
