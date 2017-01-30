// Copyright 2016, EMC, Inc.

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
     * post progress notification 
     * @param {Object} taskId: taskId
     * @param {Object} progress: progress information
     *
    */
    NotificationApiService.prototype.postProgressNotification = function(taskId, progress) {
        return waterline.taskdependencies.findOne({taskId: taskId})
        .then(function(task){
            if (_.isEmpty(task) || !_.has(task, 'graphId')){
                logger.error('notification API fails', {
                    taskId: taskId,
                    progress: progress,
                    error: "Can't find active task for given taskId"
                });
                return;
            }

            return waterline.graphobjects.findOne({instanceId: task.graphId})
            .then(function(graphObject){
                if (_.isEmpty(graphObject)) {
                    logger.error('notification api fails', {
                        taskid: taskId,
                        progress: progress,
                        error: "can't find graphObject for given taskid"
                    });
                    return;
                }
                var  progressData = {
                    graphName: graphObject.definition.friendlyName,
                    //todo: workflow progress percentage should be designed
                    progress: {
                        value: null,
                        maximum: null,
                        description: progress.description || ""
                    },
                    taskProgress: {
                        taskId: taskId,
                        taskName: graphObject.tasks[taskId].friendlyName,
                        progress: progress
                    }
                };
                return taskMessenger.publishProgressEvent(graphObject.instanceId, progressData);
            });
        });
    };

    return new NotificationApiService();
}
