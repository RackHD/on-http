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
        'TaskGraph.TaskGraph',
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
    TaskGraph, 
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
                return self.postProgressNotification(message);
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

    NotificationApiService.prototype.postProgressNotification = function(data) {
        var progressData;
        return waterline.taskdependencies.findOne({taskId: data.taskId})
        .then(function(task){
            if (!_.isEmpty(task) && _.has(task, 'graphId')){
                return waterline.graphobjects.findOne({instanceId: task.graphId})
                .then(function(graphObject){
                    //TODO: workflow progress percentage should be designed
                    progressData = {
                        graphId: graphObject.instanceId,
                        graphName: graphObject.definition.friendlyName,
                        progress: {
                            percentage: "na",
                            description: data.progress.description
                        },
                        taskProgress: {
                            graphId: graphObject.instanceId, 
                            taskId: data.taskId,
                            taskName: graphObject.tasks[data.taskId].friendlyName,
                            progress: data.progress 
                        }
                    };
                    return TaskGraph.prototype.updateGraphProgress(progressData);
                });
            } else {
                logger.error('notification API fails', {
                    progress: data,
                    error: "Can't find active task for given taskId" 
                });
            }
        });
    };

    return new NotificationApiService();
}
