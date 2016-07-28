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

        return Promise.try(function() {
            if (!message.taskId || !_.isString(message.taskId)) {
                throw new Errors.BadRequestError('Missing task ID in query or body');
            };
            if (!message.data || !(_.isString(message.data) || _.isObject(message.data))) {
                throw new Errors.BadRequestError('Missing notification data in query or body');
            }            
        })
        .then(function () {
            return eventsProtocol.publishTaskNotification(
                message.taskId,
                message.data
            );
        })
        .then(function () {
            return {
                taskId: message.taskId,
                data: message.data
            }
        });
    };

    return new notificationApiService();
}
