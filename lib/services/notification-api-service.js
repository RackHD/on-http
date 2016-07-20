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

    notificationApiService.prototype.postNotification = function(configuration) {
        var self = this;
        var activeTaskId, activeGraphId;
        var nodeId;

        return Promise.try(function() {
            if (!configuration.nodeId || !_.isString(configuration.nodeId)) {
                throw new Errors.BadRequestError('Missing node ID in query or body');
            };
            if (!configuration.type || !_.isString(configuration.type)) {
                throw new Errors.BadRequestError('Missing notification type in query or body');
            };
            if (!configuration.data || !_.isString(configuration.data)) {
                throw new Errors.BadRequestError('Missing notification data in query or body');
            }            
        })
        .then(function() {
            nodeId = configuration.nodeId;
            return waterline.nodes.needByIdentifier(nodeId)
        })
        .then(function () {
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

            activeTaskId = activeTask.taskId;
            activeGraphId = activeGraph.instanceId;

            return eventsProtocol.publishTaskNotification(
                nodeId,
                activeTaskId,
                activeGraphId,
                configuration.type,
                configuration.data
                )
        })
        .then(function () {
            return {
                node: nodeId,
                activeTask: activeTaskId,
                activeGraph: activeGraphId,
                type: configuration.type,
                data: configuration.data
            }
        });
    };

    return new notificationApiService();
}
