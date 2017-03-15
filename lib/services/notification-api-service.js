// Copyright © 2016-2017 Dell Inc. or its subsidiaries.  All Rights Reserved.

'use strict';

var di = require('di');

module.exports = NotificationApiServiceFactory;
di.annotate(NotificationApiServiceFactory, new di.Provide('Http.Services.Api.Notification'));
di.annotate(NotificationApiServiceFactory,
    new di.Inject(
        'Protocol.Events',
        'Protocol.Task',
        'TaskGraph.Store',
        'Task.Messenger',
        'Logger',
        'Services.Waterline',
        'Errors',
        'Promise',
        'GraphProgress',
        '_'
    )
);

function NotificationApiServiceFactory(
    eventsProtocol,
    taskProtocol,
    taskGraphStore,
    taskMessenger,
    Logger,
    waterline,
    Errors,
    Promise,
    GraphProgress,
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
                return self.postProgressNotification(message.taskId, message.progress);
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

    /**
     * post task progress notification
     * @param {Object} taskId: taskId
     * @param {Object} taskProgress: task progress information
     *
    */
    NotificationApiService.prototype.postProgressNotification = function(taskId, taskProgress) {
        return waterline.taskdependencies.findOne({taskId: taskId})
        .then(function(task) {
            if (_.isEmpty(task) || !_.has(task, 'graphId')) {
                throw new Errors.BadRequestError('Cannot find the active task for taskId ' + taskId); //jshint ignore: line
            }

            return waterline.graphobjects.findOne({instanceId: task.graphId})
            .then(function(graph) {
                if (_.isEmpty(graph)) {
                    throw new Errors.BadRequestError('Cannot find the graphObject for graphId ' + task.graphId); //jshint ignore: line
                }
                var progress = GraphProgress.create(graph, taskProgress.description);
                progress.updateTaskProgress(taskId, taskProgress, false);
                return eventsProtocol.publishProgressEvent(graph.instanceId,
                                                           progress.getProgressEventData());
            });
        });
    };

    return new NotificationApiService();
}
