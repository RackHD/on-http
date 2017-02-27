// Copyright © 2016-2017 Dell Inc. or its subsidiaries.  All Rights Reserved.

'use strict';

var di = require('di');

module.exports = NotificationApiServiceFactory;
di.annotate(NotificationApiServiceFactory, new di.Provide('Http.Services.Api.Notification'));
di.annotate(NotificationApiServiceFactory,
    new di.Inject(
        'Protocol.Events',
        'Protocol.Task',
        'Task.Messenger',
        'Logger',
        'Services.Waterline',
        'Errors',
        'Promise',
        'Services.GraphProgress',
        '_'
    )
);

function NotificationApiServiceFactory(
    eventsProtocol,
    taskProtocol,
    taskMessenger,
    Logger,
    waterline,
    Errors,
    Promise,
    graphProgressService,
    _
) {
    var logger = Logger.initialize(NotificationApiServiceFactory);

    function NotificationApiService() {
    }

    NotificationApiService.prototype.postNotification = function(message) {
        var self = this;

        if (_.has(message, 'nodeId')) {
            return self.postNodeNotification(message);
        } else if (_.has(message, 'taskId')) {
            if (_.has(message, 'progress')) {
                // This will be progress update notification if taskId is specified
                return graphProgressService.postProgressNotification(
                    message.taskId,
                    message.progress
                );
            }
        }
        else {
            // This will be a broadcast notification if no id (like nodeId) is specified
            return self.postBroadcastNotification(message);
        }
    };

    NotificationApiService.prototype.postNodeNotification = function(message) {

        return Promise.try(function() {
            if (!message.nodeId || !_.isString(message.nodeId)) {
                throw new Errors.BadRequestError('Invalid node ID in query or body');
            }
        })
        .then(function () {
            return waterline.nodes.needByIdentifier(message.nodeId);
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

    NotificationApiService.prototype.postBroadcastNotification = function(message) {
        return eventsProtocol.publishBroadcastNotification(message)
        .then(function () {
            return message;
        });
    };

    return new NotificationApiService();
}
