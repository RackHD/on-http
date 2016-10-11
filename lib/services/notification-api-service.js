// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di');

module.exports = notificationApiServiceFactory;
di.annotate(notificationApiServiceFactory, new di.Provide('Http.Services.Api.Notification'));
di.annotate(notificationApiServiceFactory,
    new di.Inject(
        'Protocol.Events',
        'Protocol.Task',
        'TaskGraph.Store',
        'Logger',
        'Services.Waterline',
        'Errors',
        'Promise',
        '_'
    )
);

function notificationApiServiceFactory(
    eventsProtocol,
    taskProtocol,
    taskGraphStore,
    Logger,
    waterline,
    Errors,
    Promise,
    _
) {
    var logger = Logger.initialize(notificationApiServiceFactory);

    function notificationApiService() {
    }

    notificationApiService.prototype.postNotification = function(message) {
        var self = this;

        if (_.has(message, 'nodeId')) {
            return self.postNodeNotification(message);
        }
        // Add other cases here if to support more notification types

        // This will be a broadcast notification if no id (like nodeId) is specified
        else {
            return self.postBroadcastNotification(message);
        }
    };

    notificationApiService.prototype.postNodeNotification = function(message) {
        var self = this;

        return Promise.try(function() {
            if (!message.nodeId || !_.isString(message.nodeId)) {
                throw new Errors.BadRequestError('Invalid node ID in query or body');
            };
        })
        .then(function () {
            return waterline.nodes.needByIdentifier(message.nodeId)
        })
        .then(function (node) {
            if(!node) {
                throw new Errors.BadRequestError('Node not found');
            }
            return eventsProtocol.publishNodeNotification(message.nodeId, message);
        })
        .then(function () {
            return message;
        });
    };

    notificationApiService.prototype.postBroadcastNotification = function(message) {
        var self = this;

        return eventsProtocol.publishBroadcastNotification(message)
        .then(function () {
            return message;
        });
    };

    return new notificationApiService();
}
