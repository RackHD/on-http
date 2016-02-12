// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di');

module.exports = nodeApiServiceFactory;
di.annotate(nodeApiServiceFactory, new di.Provide('Http.Services.Api.Nodes'));
di.annotate(nodeApiServiceFactory,
    new di.Inject(
        'Protocol.TaskGraphRunner',
        'Services.Waterline',
        'Errors',
        'Logger',
        '_',
        'Promise',
        'Constants',
        'Task.Services.OBM',
        'Services.Configuration',
        'ipmi-obm-service'
    )
);
function nodeApiServiceFactory(
    taskGraphProtocol,
    waterline,
    Errors,
    Logger,
    _,
    Promise,
    Constants,
    ObmService,
    configuration,
    ipmiObmServiceFactory
) {
    var logger = Logger.initialize(nodeApiServiceFactory);

    function NodeApiService() {
    }

    /**
     * Find target nodes that relate with the removing node
     * @param  {Object}     node
     * @param  {String}     type
     * @return {Promise}    array of target nodes
     */
    NodeApiService.prototype._findTargetNodes = function(node, type) {
        if (!_.has(node, 'relations')) {
            return Promise.resolve([]);
        }

        var relation = _.find(node.relations, { relationType: type });
        if (!relation || !_.has(relation, 'targets') ) {
            return Promise.resolve([]);
        }

        return Promise.map(relation.targets, function (targetNodeId) {
            return waterline.nodes.needByIdentifier(targetNodeId)
            .catch(function (err) {
                logger.warning("Error getting target node with type " + type,
                    { error: err });
                return;
            });
        });
    };

    /**
     * Remove the relations to original node in target node. If the node is invalid
     * or doesn't have required relation, this function doesn't need to update the
     * node info and ignore silently with Promise.resolve(). If the relation field
     * is empty after removing, delete this field.
     * @param  {Object}     node node whose relation needs to be updated
     * @param  {String}     type relation type that needs to be updated
     * @param  {String}     targetId id in relation type that needs to be deleted
     * @return {Promise}    node after removing relation
     */
    NodeApiService.prototype._removeRelation = function(node, type, targetId) {

        if (!node) {
            return Promise.resolve();
        }

        // Remove the relationship between node and downstram node
        if (!_.has(node, 'relations')) {
            return Promise.resolve();
        }

        var index = _.findIndex(node.relations, { relationType: type });
        if (index === -1 || !_.has(node.relations[index], 'targets')) {
            return Promise.resolve();
        }

        // Remove target node id in relation field
        if (_.indexOf(node.relations[index].targets, targetId) !== -1) {
            _.pull(node.relations[index].targets, targetId);
        }

        // Remove the type of relation if no targets in it
        if (node.relations[index].targets.length === 0) {
            _.pull(node.relations, node.relations[index]);
        }

        return waterline.nodes.updateByIdentifier(node.id,
                                                  {relations: node.relations});
    };

    /**
     * Handle target nodes. Update relation type field and remove the target
     * node if needed.
     * @param  {Array}      targetNodes array of target nodes
     * @param  {String}     type relation type in the removing node
     * @param  {String}     nodeId removing node id
     * @return {Promise}
     */
    NodeApiService.prototype._handleTargetNodes = function(targetNodes, type, nodeId) {
        var self = this;
        var targetType = '';
        var relationClass = null;
        var needDel = false;

        if (Constants.NodeRelations.hasOwnProperty(type)) {
            targetType = Constants.NodeRelations[type].mapping;
            relationClass = Constants.NodeRelations[type].relationClass;
        }

        if ((relationClass === 'component') &&
            (type.indexOf('By') === -1)) {
            // Its components need to be deleted
            needDel = true;
        }

        return Promise.resolve()
        .then(function () {
            if (needDel === true) {
                // Throw error when all target nodes need to be deleted
                // but at least one of them have active workflow
                return Promise.map(targetNodes, function(targetNode) {
                    return self._delValidityCheck(targetNode.id);
                });
            }
        })
        .then(function () {
            return Promise.map(targetNodes, function (targetNode) {
                // Delete target nodes if it is required
                if (needDel === true) {
                    return self.removeNode(targetNode, targetType);
                }

                // Update relations in the target node
                return self._removeRelation(targetNode, targetType, nodeId)
                .then(function (targetNode) {
                    if (targetNode) {
                        logger.debug('node updated', {id: targetNode.id, relation: targetType});
                    }
                });
            });
        });
    };

    /**
     * Check whether a node is valid to be deleted
     * @param  {String}     nodeId
     * @return {Promise}
     */
    NodeApiService.prototype._delValidityCheck = function(nodeId) {
        return taskGraphProtocol.getActiveTaskGraph( { target: nodeId })
        .then(function (graph) {
            if (graph) {
                // If there is active workflow, the node cannot be deleted
                return Promise.reject('Could not remove node ' + nodeId +
                    ', active workflow is running');
            }
            return Promise.resolve();
        });
    };

    /**
     * Remove node related data and remove its relations with other nodes
     * @param  {Object}     node
     * @param  {String}     srcType
     * @return {Promise}
     */
    NodeApiService.prototype.removeNode = function(node, srcType) {
        var self = this;

        return self._delValidityCheck(node.id)
        .then(function () {
            if (!node.hasOwnProperty('relations')) {
                return Promise.resolve();
            }

            return Promise.map(node.relations, function(relation) {

                var type = relation.relationType;

                // Skip handling relationType that comes from the upstream node
                // to avoid deleting upstream nodes more than once
                if (srcType && (srcType === type)) {
                    return Promise.resolve();
                }

                // Otherwise update targets node in its "relationType"
                return self._findTargetNodes(node, type)
                .then(function (targetNodes) {
                    return self._handleTargetNodes(targetNodes, type, node.id);
                });
            });
        })
        .then(function () {
            return Promise.settle([
                //lookups should be destoryed here, only clear node field
                //as a workaround until the issue that when lookups are cleared
                //it cannot be updated timely in nodes' next bootup is fixed
                waterline.lookups.update({ node: node.id },{ node: '' } ),
                waterline.nodes.destroy({ id: node.id }),
                waterline.catalogs.destroy({ node: node.id }),
                waterline.workitems.destroy({ node: node.id })
            ]);
        })
        .then(function () {
            logger.debug('node deleted', {id: node.id, type: node.type});
            return node;
        });
    };

    /**
     * Get list of nodes
     * @param {Object} query [req.query] HTTP Request
     * @returns {Promise}
     */
    NodeApiService.prototype.getAllNodes = function(query) {
        return waterline.nodes.find(query);
    };

    NodeApiService.prototype.postNode = function(body) {
        return waterline.nodes.create(body)
            .then(function(node) {
                if(node.type === 'switch' && node.snmpSettings && node.autoDiscover) {
                    taskGraphProtocol.runTaskGraph(
                        'Graph.Switch.Discovery',
                        { defaults: _.assign(node.snmpSettings, { nodeId: node.id }) },
                        node.id
                    );
                }
                else if(node.type === 'pdu' && node.snmpSettings && node.autoDiscover) {
                    taskGraphProtocol.runTaskGraph(
                        'Graph.PDU.Discovery',
                        { defaults: _.assign(node.snmpSettings, { nodeId: node.id }) },
                        node.id
                    );
                }
                else if(node.type === 'mgmt' && node.obmSettings && node.autoDiscover) {
                    var options = {
                        defaults: {
                            graphOptions: {
                                target: node.id
                            },
                            nodeId: node.id
                        }
                    };
                    taskGraphProtocol.runTaskGraph(
                        'Graph.MgmtSKU.Discovery',
                        options,
                        undefined
                    );
                }
                return node;
            });
    };

    NodeApiService.prototype.getNodeById = function(id) {
        return waterline.nodes.needByIdentifier(id);
    };

    NodeApiService.prototype.patchNodeById = function(id, body) {
        return waterline.nodes.needByIdentifier(id)
            .then(function (node){
                if (body.obmSettings) {
                    return ObmService.checkValidService(node, body.obmSettings);
                }
            })
            .then(function () {
                return waterline.nodes.updateByIdentifier (
                    id,
                    body
                );
            });
    };

    NodeApiService.prototype.delNodeById = function(id) {
        var self = this;
        return waterline.nodes.needByIdentifier(id)
            .then(function (node) {
                return self.removeNode(node);
            });
    };

    NodeApiService.prototype.getNodeObmById = function(id) {
        return waterline.nodes.needByIdentifier(id)
            .then(function (node) {
                if (node) {
                    if (_.isEmpty(node.obmSettings)) {
                        throw new Errors.NotFoundError(
                            'No OBM Found (' + id + ').'
                        );
                    }
                    return node.obmSettings;
                }
            });
    };

    NodeApiService.prototype.postNodeObmById = function(id, body) {
        return waterline.nodes.needByIdentifier(id)
            .then(function (node){
                return ObmService.checkValidService(node, body)
                    .then(function () {
                        return node;
                    });
            })
            .then(function (node) {
                var obmSettings = node.obmSettings || [];
                obmSettings.push(body);
                return waterline.nodes.updateByIdentifier(
                    id,
                    { obmSettings: obmSettings }
                );
            });
    };

    NodeApiService.prototype.postNodeObmIdById = function(id, body) {
        // TODO: Make this a taskGraph instead once we improve multiple task
        // graph handling per node.
        return waterline.nodes.needByIdentifier(id)
            .then(function (node) {
                if (node) {
                    var settings = _.find(node.obmSettings, function(setting) {
                        return setting ? setting.service === 'ipmi-obm-service' : false;
                    });

                    // TODO: make this a constant?
                    var obmService = ObmService.create(node.id, ipmiObmServiceFactory, settings);
                    if (body && body.value) {
                        return obmService.identifyOn(node.id);
                    } else {
                        return obmService.identifyOff(node.id);
                    }
                }
            });
    };

    NodeApiService.prototype.getNodeCatalogById = function(id) {
        return waterline.nodes.needByIdentifier(id)
            .then(function (node) {
                return waterline.catalogs.find({ node: node.id });
            });
    };

    NodeApiService.prototype.getNodeCatalogSourceById = function(id, source) {
        return waterline.nodes.needByIdentifier(id)
            .then(function(node) {
                if (node && node.id) {
                    return waterline.catalogs.findLatestCatalogOfSource(
                        node.id, source
                    ).then(function (catalogs) {
                        if (_.isEmpty(catalogs)) {
                            throw new Errors.NotFoundError(
                                'No Catalogs Found for Source (' + source + ').'
                            );
                        }

                        return catalogs;
                    });
                }
            });
    };

    NodeApiService.prototype.getPollersByNodeId = function (id) {
        return waterline.nodes.needByIdentifier(id)
            .then(function (node) {
                if (node) {
                    return waterline.workitems.findPollers({ node: node.id });
                }
            });

    };

    NodeApiService.prototype.getNodeWorkflowById = function (id) {
        //TODO(heckj) this is intended to show past workflows - not sure how
        // to do that with taskGraph Service
        return waterline.nodes.needByIdentifier(id)
            .then(function (node) {
                return waterline.graphobjects.find({ node: node.id });
            });
    };

    NodeApiService.prototype.setNodeWorkflow = function (id, name, options) {
        return waterline.nodes.needByIdentifier(id)
            .then(function (node) {
                return taskGraphProtocol.runTaskGraph(
                    name,
                    options || {},
                    node.id);
            });
    };

    NodeApiService.prototype.setNodeWorkflowById = function( id, workflowConfig ) {
        return waterline.nodes.needByIdentifier(id)
            .then(function(node) {
                return taskGraphProtocol.runTaskGraph(
                    workflowConfig.name,
                    workflowConfig.options || {},
                    node.id);
            });
    };

    NodeApiService.prototype.getActiveNodeWorkflowById = function(id) {
        return waterline.nodes.needByIdentifier(id)
            .then(function (node) {
                return taskGraphProtocol.getActiveTaskGraph( { target: node.id })
                    .then(function (graph) {
                        if (graph) {
                            return waterline.graphobjects.findOne({ instanceId: graph.instanceId });
                        }
                    });
            });
    };

    NodeApiService.prototype.delActiveWorkflowById = function (id) {
        return waterline.nodes.needByIdentifier(id)
            .then(function (node) {
                return taskGraphProtocol.cancelTaskGraph({ target: node.id });
            });
    };

    return new NodeApiService();
}
