// Copyright © 2016-2017 Dell Inc. or its subsidiaries.  All Rights Reserved.

'use strict';

var di = require('di');

module.exports = workflowApiServiceFactory;
di.annotate(workflowApiServiceFactory, new di.Provide('Http.Services.Api.Workflows'));
di.annotate(workflowApiServiceFactory,
    new di.Inject(
        'Protocol.Events',
        'Logger',
        'Errors',
        'Promise',
        'Constants',
        '_',
        'Services.Lookup',
        'Http.Services.Api.Taskgraph.Scheduler',
        'Assert'
    )
);

function workflowApiServiceFactory(
    eventsProtocol,
    Logger,
    Errors,
    Promise,
    Constants,
    _,
    lookupService,
    taskgraphService,
    assert
) {
    var logger = Logger.initialize(workflowApiServiceFactory);

    function WorkflowApiService() {
    }

    WorkflowApiService.prototype.createAndRunGraph = function (configuration, nodeId) {
        var self = this;
        return Promise.try(function () {
            if (!configuration.name || !_.isString(configuration.name)) {
                throw new Errors.BadRequestError('Graph name is missing or in wrong format');
            }
        })
        .then(function () {
            if(nodeId !== null){
                return taskgraphService.workflowsPost(configuration,nodeId);
            } else {
                  return taskgraphService.workflowsPost(configuration);
            }
        });
    };

    WorkflowApiService.prototype.findGraphDefinitionByName = function (graphName) {
        return taskgraphService.workflowsGetByInstanceId(graphName)
        .then(function (graph) {
            if (_.isEmpty(graph)) {
                throw new Errors.NotFoundError('Graph definition not found for ' + graphName);
            } else {
                return graph[0];
            }
        });
    };

    WorkflowApiService.prototype.cancelTaskGraph = function (graphId) {
        return taskgraphService.workflowsAction(graphId, 'cancel');
    };

    WorkflowApiService.prototype.deleteTaskGraph = function (graphId) {
        return taskgraphService.workflowsDeleteByInstanceId(graphId);
    };

    WorkflowApiService.prototype.defineTaskGraph = function (definition) {
        // Do validation before persisting a definition
        return taskgraphService.workflowsPutGraphs(definition);
    };

    WorkflowApiService.prototype.defineTask = function (definition) {
        return taskgraphService.workflowsPutTask(definition);
    };

    WorkflowApiService.prototype.getWorkflowsTasksByName = function (injectableName) {
        return taskgraphService.workflowsGetTasksByName(injectableName)
        .then(function (data) {
            return data[0];
        });
    };

    WorkflowApiService.prototype.deleteWorkflowsTasksByName = function (injectableName) {
        return taskgraphService.workflowsDeleteTasksByName(injectableName);
    };

    WorkflowApiService.prototype.getGraphDefinitions = function (injectableName) {
        if (injectableName) {
            return taskgraphService.workflowsGetGraphsByName(injectableName);
        }
        return taskgraphService.workflowsGetGraphs();
    };

    WorkflowApiService.prototype.getTaskDefinitions = function () {
        return taskgraphService.workflowsGetAllTasks();
    };

    WorkflowApiService.prototype.findActiveGraphForTarget = function (target) {
        return taskgraphService.workflowsGet({
            where: {
                node: target,
                _status: Constants.Task.ActiveStates
            }
        })
        .then(function(graphs) {
            return _.first(graphs);
        });
    };

    WorkflowApiService.prototype.getWorkflowsByNodeId = function (id, query) {
        var nodeId = ({ node: id });
        var mergedQuery = _.merge({}, nodeId, query);
        return taskgraphService.workflowsGet({where: mergedQuery});
    };

    WorkflowApiService.prototype.getAllWorkflows = function (where) {
        var query = {
            where: where
        };

        return taskgraphService.workflowsGet(query);
    };

    WorkflowApiService.prototype.getWorkflowByInstanceId = function (instanceId) {
        return taskgraphService.workflowsGet({where: {instanceId: instanceId}})
        .then(function(result) {
            if(_.isEmpty(result)) {
                throw new Errors.NotFoundError('Graph instance not found for ' + instanceId);
            }
            return result[0];
        });
    };

    WorkflowApiService.prototype.destroyGraphDefinition = function (injectableName) {
        return taskgraphService.workflowsDeleteGraphsByName(injectableName);
    };

    return new WorkflowApiService();
}
