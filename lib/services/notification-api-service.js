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
    Errors,
    Promise,
    _
) {
    var logger = Logger.initialize(notificationApiServiceFactory);

    function notificationApiService() {
    }

    notificationApiService.prototype.postNotification = function(configuration) {
        var self = this;
        return Promise.try(function() {
            if (!configuration.nodeId || !_.isString(configuration.nodeId)) {
                throw new Errors.BadRequestError('Missing node ID in query');
            };
            if (!configuration.type || !_.isString(configuration.type)) {
                throw new Errors.BadRequestError('Missing notification type in query');
            };
            if (!configuration.data || !_.isString(configuration.data)) {
                throw new Errors.BadRequestError('Missing notification data in query');
            }            
        })
        .then(function() {
            var nodeId = configuration.nodeId;
            return [
                taskGraphStore.findActiveGraphForTarget(nodeId),
                taskProtocol.activeTaskExists(nodeId)
            ]
        })
        .spread(function (activeGraph, activeTask) {
            if (!activeGraph) {
                throw new Error("No active task graph.");
            }
            if (!activeTask) {
                throw new Error("No active task.");
            }
            console.log("-------Ted: find active graph", activeGraph);
            console.log("-------Ted: find active task", activeTask);

            return eventsProtocol.publishTaskNotification(
                configuration.nodeId,
                activeTask.taskId,
                activeGraph.instanceId,
                configuration.type,
                configuration.data
                )
        });
    };

    return new notificationApiService();
}
