// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di');

module.exports = workflowApiServiceFactory;
di.annotate(workflowApiServiceFactory, new di.Provide('Http.Services.Api.Workflows'));
di.annotate(workflowApiServiceFactory,
    new di.Inject(
        'Protocol.TaskGraphRunner',
        'TaskGraph.Store',
        'Services.Waterline',
        'TaskGraph.TaskGraph',
        'Logger',
        'Errors',
        'Promise',
        'Constants',
        '_'
    )
);

function workflowApiServiceFactory(
    taskGraphProtocol,
    taskGraphStore,
    waterline,
    TaskGraph,
    Logger,
    Errors,
    Promise,
    Constants,
    _
) {
    var logger = Logger.initialize(workflowApiServiceFactory);

    function WorkflowApiService() {
    }

    WorkflowApiService.prototype.createAndRunGraph = function(configuration, nodeId) {
        var self = this;
        return Promise.resolve()
        .then(function() {
            if (nodeId) {
                return waterline.nodes.needByIdentifier(nodeId)
                .then(function(node) {
                    return [
                        self.findGraphDefinitionByName(configuration.name),
                        taskGraphStore.findActiveGraphForTarget(node.id),
                        node
                    ];
                });
            } else {
                return [self.findGraphDefinitionByName(configuration.name), null, null];
            }
        })
        .spread(function(definition, activeGraph, node) {
            if (activeGraph) {
                throw new Error("Unable to run multiple task graphs against a single target.");
            }
            var context = configuration.context || {};
            if (node) {
                context = _.defaults(context, { target: node.id });
            }
            return self.createActiveGraph(
                        definition, configuration.options, context, configuration.domain, true);
        })
        .then(function(graph) {
            self.runTaskGraph(graph.instanceId, configuration.domain);
            return graph;
        });
    };

    WorkflowApiService.prototype.findGraphDefinitionByName = function(graphName) {
        return taskGraphStore.getGraphDefinitions(graphName)
        .then(function(graph) {
            if (_.isEmpty(graph)) {
                throw new Errors.NotFoundError('Graph definition not found for ' + graphName);
            } else {
                return graph[0];
            }
        });
    };

    WorkflowApiService.prototype.createActiveGraph = function(
            definition, options, context, domain) {
        return this.createGraph(definition, options, context, domain)
        .then(function(graph) {
            return graph.persist();
        });
    };

    WorkflowApiService.prototype.createGraph = function(definition, options, context, domain) {
        domain = domain || Constants.DefaultTaskDomain;
        return Promise.resolve()
        .then(function() {
            return TaskGraph.create(domain, {
                definition: definition,
                options: options || {},
                context: context
            });
        })
        .catch(function(error) {
            if (!error.status) {
                var badRequestError = new Errors.BadRequestError(error.message);
                badRequestError.stack = error.stack;
                throw badRequestError;
            }
            throw error;
        });
    };

    WorkflowApiService.prototype.runTaskGraph = function(graphId, domain) {
        return taskGraphProtocol.runTaskGraph(graphId, domain)
        .catch(function(error) {
            logger.error('Error publishing event to run task graph', {
                error: error,
                graphId: graphId,
                domain: domain
            });
        });
    };

    WorkflowApiService.prototype.cancelTaskGraph = function(graphId) {
        return taskGraphProtocol.cancelTaskGraph(graphId);
    };

    WorkflowApiService.prototype.defineTaskGraph = function(definition) {
        // Do validation before persisting a definition
        return this.createGraph(definition)
        .then(function() {
            return taskGraphStore.persistGraphDefinition(definition);
        })
        .then(function(definition) {
            return definition.injectableName;
        });
    };

    WorkflowApiService.prototype.defineTask = function(definition) {
        return taskGraphStore.persistTaskDefinition(definition);
    };

    WorkflowApiService.prototype.getGraphDefinitions = function(injectableName) {
        return taskGraphStore.getGraphDefinitions(injectableName);
    };

    WorkflowApiService.prototype.getTaskDefinitions = function(injectableName) {
        return taskGraphStore.getTaskDefinitions(injectableName);
    };

    WorkflowApiService.prototype.findActiveGraphForTarget = function(target) {
        return taskGraphStore.findActiveGraphForTarget(target);
    };

    return new WorkflowApiService();
}
