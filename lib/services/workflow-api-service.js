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
        '_',
        'Services.Environment',
        'Services.Lookup'
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
    _,
    env,
    lookupService
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
                    if(node.sku) {
                        return [node, env.get(configuration.name, configuration.name, [node.sku])];
                    }
                    return [node, configuration.name];
                }).spread(function(node, name) {
                    return [
                        self.findGraphDefinitionByName(name),
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
            return Promise.resolve().then(function() {
                if(node) {
                    context = _.defaults(context, { target: node.id });
                    return lookupService.nodeIdToProxy(node.id)
                    .catch(function(error) {
                        // allow the proxy lookup to fail since not all nodes 
                        // wanting to run a workflow may have an entry
                        logger.error('nodeIdToProxy Lookup', {error:error});
                    });
                } else {
                    return undefined;
                }
            }).then(function(proxy) {
                if(proxy) {
                    context.proxy = proxy;
                }
                return self.createActiveGraph(
                        definition, configuration.options, context, configuration.domain, true);
            });
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
            graph._status = Constants.Task.States.Running;
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
        var instanceId;

        return waterline.graphobjects.needByIdentifier(graphId)
        .then(function(workflow) {
            instanceId = workflow.instanceId;

            if (!workflow.active()) {
                throw new Errors.TaskCancellationError(
                    graphId + ' is not an active workflow'
                );
            }

            return taskGraphProtocol.cancelTaskGraph(instanceId);
        });
    };

    WorkflowApiService.prototype.deleteTaskGraph = function(graphId) {
        var instanceId;

        // Taskgraph deletion sequence:
        // 1) Get the graph object by ID
        // 2) Check if the returned workflow is running.
        // 3) If it is running, throw an error. Otherwise go on to step 4.
        // 4) Delete the graph object from the task graph store.
        return waterline.graphobjects.needByIdentifier(graphId)
        .then(function(workflow) {
            // Since deleteGraph takes instanceId as an argument, save it
            // here using a closure so we don't need to do another query later.
            instanceId = workflow.instanceId;
            if (workflow.active()) {
                throw new Errors.ForbiddenError('Forbidden to delete an active workflow ' + graphId);
            }
            return instanceId;
        })
        .then(function(cancelledGraphId) {
            if (cancelledGraphId !== instanceId) {
                // Cancelled graph ID doesn't match the requested ID.
                throw new Errors.TaskCancellationError('Failed to cancel ' + graphId);
            }
            return taskGraphStore.deleteGraph(instanceId);
        })
        .then(function(deletedGraphs) {
            return deletedGraphs[0];
        });
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

    WorkflowApiService.prototype.getWorkflowsTasksByName = function(injectableName) {
        return taskGraphStore.getTaskDefinitions(injectableName);
    };

    WorkflowApiService.prototype.deleteWorkflowsTasksByName = function(injectableName) {
        return taskGraphStore.getTaskDefinitions(injectableName)
            .then(function (task){
                if(_.isEmpty(task)){
                    throw new Errors.NotFoundError(
                        'Task definition not found for ' + injectableName
                    );
                }else{
                    return taskGraphStore.deleteTaskByName(injectableName);

                }
            });
    };

    WorkflowApiService.prototype.putWorkflowsTasksByName = function(definition, injectableName) {
        return taskGraphStore.getTaskDefinitions(injectableName)
            .then(function (task){
                if(_.isEmpty(task)){
                    throw new Errors.NotFoundError(
                        'Task definition not found for ' + injectableName
                    );
                }else{
                    return taskGraphStore.persistTaskDefinition(definition);
                }
            });
    };


    WorkflowApiService.prototype.getGraphDefinitions = function(injectableName) {
        return taskGraphStore.getGraphDefinitions(injectableName);
    };

    WorkflowApiService.prototype.getTaskDefinitions = function(injectableName) {
        return taskGraphStore.getTaskDefinitions(injectableName);
    };

    WorkflowApiService.prototype.findActiveGraphForTarget = function(target) {
        return waterline.graphobjects.findOne({
            node: target,
            _status: Constants.Task.ActiveStates
        });
    };

    WorkflowApiService.prototype.getActiveWorkflows = function(query) {
        return waterline.graphobjects.find(query);
    };

    WorkflowApiService.prototype.getWorkflowById = function(id) {
        return waterline.graphobjects.needByIdentifier(id);
    };

    WorkflowApiService.prototype.destroyGraphDefinition = function(injectableName) {
        return taskGraphStore.destroyGraphDefinition(injectableName);
    };

    return new WorkflowApiService();
}
