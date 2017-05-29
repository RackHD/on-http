// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved.

'use strict';

var di = require('di');

module.exports = nodeApiServiceFactory;
di.annotate(nodeApiServiceFactory, new di.Provide('Http.Services.Api.Nodes'));
di.annotate(nodeApiServiceFactory,
    new di.Inject(
        'Http.Services.Api.Workflows',
        'Services.Waterline',
        'Errors',
        'Logger',
        '_',
        'Promise',
        'Constants',
        'Task.Services.OBM',
        'Services.Configuration',
        'ipmi-obm-service',
        'Assert',
        'Protocol.Events'
    )
);
function nodeApiServiceFactory(
    workflowApiService,
    waterline,
    Errors,
    Logger,
    _,
    Promise,
    Constants,
    ObmService,
    configuration,
    ipmiObmServiceFactory,
    assert,
    eventsProtocol
) {
    var logger = Logger.initialize(nodeApiServiceFactory);

    function NodeApiService() {
    }

    /**
     * Find target nodes that relate with the removing node
     * @param  {Object}     relations - The relations object of a node
     * @param  {String}     type
     * @return {Promise}    array of target nodes
     */
    NodeApiService.prototype._findTargetNodes = function(relations, type) {
        return this._needTargetNodes(relations, type)
        .catch(function (err) {
            logger.warning("Error getting target node with type " + type,
                { error: err });
            return [];
        });
    };

    NodeApiService.prototype._needTargetNodes = function(relations, type) {
        if (!relations) {
            return Promise.resolve([]);
        }

        var relation = _.find(relations, { relationType: type });
        if (!relation || !_.has(relation, 'targets') ) {
            return Promise.resolve([]);
        }

        return Promise.map(relation.targets, function (targetNodeId) {
            return waterline.nodes.needByIdentifier(targetNodeId);
        });
    };

    /**
     * Remove the relations to original node in target node. If the node is invalid
     * or doesn't have required relation, this function doesn't need to update the
     * node info and ignore silently with Promise.resolve(). If the relation field
     * is empty after removing, delete this field. If the node to be updated is a component
     * of a node delete it
     * @param  {Object}     node node whose relation needs to be updated
     * @param  {String}     type relation type that needs to be updated
     * @param  {String[] | Object[]}    targets - nodes or ids in the relation
     * that needs to be deleted
     * @return {Object}    node after removing relation
     */
    NodeApiService.prototype._removeRelation = function removeRelation(node, type, targets) {
        if (!node || !type || !_.has(node, 'relations')) {
            return;
        }

        var index = _.findIndex(node.relations, { relationType: type });
        if (index === -1 || !_.has(node.relations[index], 'targets')) {
            return;
        }

        // Remove target node id in relation field
        targets = [].concat(targets).map(function(node) {return node.id || node;});
        node.relations[index].targets = _.difference(node.relations[index].targets, targets);
        // Remove the type of relation if no targets in it
        if (node.relations[index].targets.length === 0) {
            _.pull(node.relations, node.relations[index]);
        }

        return node;
    };

    /**
     * Add the given target nodes to the given relationType on the given node. Fail
     * silently with missing arguments. If a relation does not already exist on the node
     * create it, otherwise append to the existing one.
     * @param  {Object} node - node whose relation needs to be updated
     * @param  {String} type - relation type that needs to be updated
     * @param  {String[] | Object[]}  targets - nodes or ids in relation type that needs to be added
     * @return {Object}  the updated node
     */
    NodeApiService.prototype._addRelation = function addRelation(node, type, targets) {
        if (!(node && type && targets)) {
            return;
        }

        node.relations = (node.relations || []);

        targets = _.map([].concat(targets), function(targetNode) {
            targetNode = targetNode.id || targetNode;
            if(targetNode === node.id ) {
                throw new Error('Node cannot have relationship '+type+' with itself');
            }
            return targetNode;
        });
        var index = _.findIndex(node.relations, { relationType: type });
        if (index === -1) {
            node.relations.push({relationType: type, targets: _.uniq(targets)});
        } else {
            node.relations[index].targets = _.uniq(node.relations[index].targets.concat(targets));
        }
        index = index === -1 ? node.relations.length - 1: index;
        if (type === 'containedBy' && node.relations[index].targets.length > 1) {
            throw new Error("Node "+node.id+" can only be contained by one node");
        }

        return node;
    };

    /**
     * Get the targets to be removed in node. If the node is invalid
     * or doesn't have required targets, this function doesn't need to return the
     * node relation info and ignore silently with Promise.resolve().
     * @param  {Object}     node node whose relation needs to be updated
     * @param  {String}     type relation type that needs to be updated
     * @param  {String[] | Object[]}    targets - nodes or ids in the relation
     * that needs to be deleted
     * @return {Object}    {indexPath: [tagsToBeRemoved]}
     */
    NodeApiService.prototype._getTargetsToBeRemoved = 
        function getTargetsToBeRemoved(node, type, targets){
        if (!node || !type || !_.has(node, 'relations')) {
            return;
        }

        var index = _.findIndex(node.relations, { relationType: type });
        if (index === -1 || !_.has(node.relations[index], 'targets')) {
            return;
        }

        targets = [].concat(targets).map(function(node) {return node.id || node;});
        var indexPath = ["relations.", String(index),".targets"].join("");
        var values = {};
        values[indexPath] = [].concat(targets);
        return values;
    };

    /**
     * Get the relations to be removed in node. Relations with [targets] shoud be removed.
     * If the node is invalid or doesn't have required relation, this function doesn't need to 
     * return the node relation info and ignore silently with Promise.resolve().
     * @param  {Object}     node node whose relation needs to be updated
     * @param  {String}     type relation type that needs to be updated
     * @param  {String[] | Object[]}    targets - nodes or ids in the relation
     * that needs to be deleted
     * @return {Object}    {indexPath: [tagsToBeRemoved]}
     */
    NodeApiService.prototype._getRelationsToBeRemoved = 
        function getRelationsToBeRemoved(node, type){
        if (!node || !type || !_.has(node, 'relations')) {
            return;
        }

        var index = _.findIndex(node.relations, { relationType: type });
        if (index === -1 || !_.has(node.relations[index], 'targets')) {
            return;
        }

        if (node.relations[index].targets.length !== 0) {
            return;
        }

        var values = {"relations": [node.relations[index]]};
        return values;
    };

    /**
     * Check whether a node is valid to be deleted
     * @param  {String}     nodeId
     * @return {Promise}
     */
    NodeApiService.prototype._delValidityCheck = function(nodeId) {
        return workflowApiService.findActiveGraphForTarget(nodeId)
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

                if (!Constants.NodeRelations[type]) {
                    return Promise.resolve();
                }
                // Otherwise update targets node in its "relationType"
                return self._findTargetNodes(node.relations, type)
                .then(function(targetNodes) {
                    if(Constants.NodeRelations[type].relationClass === 'component' &&
                        type.indexOf('By') === -1) {

                        return Promise.map(targetNodes, function(targetNode) {
                            return self._delValidityCheck(targetNode.id);
                        }).then(function() {
                            return Promise.map(targetNodes, function(targetNode) {
                                return self.removeNode(
                                    targetNode, Constants.NodeRelations[type].mapping
                                );
                            });
                        });
                    } else {
                        return Promise.map(targetNodes, function(targetNode) {
                            var targets = self._getTargetsToBeRemoved(
                                targetNode,
                                Constants.NodeRelations[type].mapping,
                                node.id
                            );
                            if (!targets) {
                                return;
                            }
                            return waterline.nodes
                            .removeListItemsByIdentifier(targetNode.id, targets)
                            .then(function(modifiedTargetNode){
                                var relations = self._getRelationsToBeRemoved(
                                    modifiedTargetNode,
                                    Constants.NodeRelations[type].mapping,
                                    node.id
                                );
                                if (!relations) {
                                    return;
                                }
                                return waterline.nodes
                                .removeListItemsByIdentifier(targetNode.id, relations);
                            });
                        });
                    }
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
            return eventsProtocol.publishNodeEvent(node, 'removed');
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

    NodeApiService.prototype.getAllNodes = function(query, options) {
        options = options || {};

        return Promise.try(function() {
            query = waterline.nodes.find(query);

            if (options.skip) {
                query.skip(options.skip);
            }
            if (options.limit) {
                query.limit(options.limit);
            }

            return query.populate('obms').populate('ibms');
        });
    };

    NodeApiService.prototype.postNode = function(body) {
        var nodeBody = _.omit(body, ['obms', 'ibms']);
        var obmBody = body.obms || body.obmSettings || null;
        var ibmBody = body.ibms || null;

        return Promise.resolve()
        .then(function() {
            return waterline.nodes.create(nodeBody);
        }).tap(function(node) {
            return eventsProtocol.publishNodeEvent(node, 'added');
        }).tap(function(node) {
            if (obmBody) {
                return Promise.map(obmBody, function(obm) {
                    return waterline.obms.upsertByNode(node.id, obm);
                });
            }
        }).tap(function(node) {
            if (ibmBody) {
                return Promise.map(ibmBody, function(ibm) {
                    return waterline.ibms.upsertByNode(node.id, ibm);
                });
            }
        }).then(function(node) {
            return [node, waterline.ibms.findByNode(node.id, 'snmp-ibm-service')];
        }).spread(function(node, snmpSettings) {
            if(node.type === Constants.NodeTypes.Switch &&
               snmpSettings && node.autoDiscover) {
                return workflowApiService.createAndRunGraph(
                    {
                        name: 'Graph.Switch.Discovery',
                        options: {
                            defaults: _.assign(snmpSettings, { nodeId: node.id })
                        }
                    },
                    node.id
                );
            }
            else if(node.type === Constants.NodeTypes.Pdu &&
                    snmpSettings && node.autoDiscover) {
                return workflowApiService.createAndRunGraph(
                    {
                        name: 'Graph.PDU.Discovery',
                        options: {
                            defaults: _.assign(snmpSettings, { nodeId: node.id })
                        }
                    },
                    node.id
                );
            }
            else if(node.type === Constants.NodeTypes.Mgmt &&
                    obmBody && node.autoDiscover) {
                var configuration = {
                    name: 'Graph.MgmtSKU.Discovery',
                    options: {
                        defaults: {
                            graphOptions: {
                                target: node.id
                            },
                            nodeId: node.id
                        }
                    }
                };
                return workflowApiService.createAndRunGraph(configuration);
            }
            return node;
        });
    };

    NodeApiService.prototype.getNodeById = function(id) {
        return waterline.nodes.getNodeById(id)
        .then(function (node){
            if (!node) {
                throw new Errors.NotFoundError(
                    'Node not Found ' + id
                );
            }
            return node;
        });
    };

    NodeApiService.prototype.getNodeRelations = function(id) {
        return waterline.nodes.needByIdentifier(id)
        .then(function (node){
            return node.relations || [];
        });
    };

    /**
     * Edit the relations of a given node, delegating object manipulations to the given handler.
     * Handle the update with the handler's output
     *
     * @param {String} id - a node id
     * @param {Object} body - an object with relation types as keys and arrays of target
     *      node ids as values.
     * @param {Function} handler - a function(node, relationType, targets) which edits the
     *      given node's relations and updates the node
     */
    NodeApiService.prototype.editNodeRelations = function(id, body, handler) {
        var self = this;
        return waterline.nodes.needByIdentifier(id).bind({})
        .then(function(node) {
            this.parentNode = node;
            return Promise.all(_.transform(body, function(result, targets, relationType) {
                result.push(self._needTargetNodes(
                        [{relationType: relationType, targets:targets}],
                        relationType
                    )
                );
                result.push(relationType);
            }, [])
            );
        })
        .then(function(targetRelations) {
            var parentNode = this.parentNode;
            targetRelations = _.chunk(targetRelations, 2); //divide the array into subArray chunks
                                                           //of [[targetNodes], relationType]

            var updatedNodes = _.transform(targetRelations, function(result, relationSet) {
                var targetNodes = relationSet[0];
                var relationType = relationSet[1];
                if (!Constants.NodeRelations[relationType]) {
                    return;
                }
                result[parentNode.id] = handler.call(
                        self,
                        result[parentNode.id] || parentNode,
                        relationType,
                        targetNodes
                );

                _.forEach(targetNodes, function(node) {
                    result[node.id] = handler.call(
                        self,
                        result[node.id] || node,
                        Constants.NodeRelations[relationType].mapping,
                        parentNode
                    );
                });
            }, {});

            return Promise.all(_.compact(_.map(updatedNodes, function(updatedNode) {
                if (!updatedNode) {
                    return;
                }
                return waterline.nodes.updateByIdentifier(
                    updatedNode.id, {relations: updatedNode.relations}
                );
            })));
        });
    };

    NodeApiService.prototype.patchNodeById = function(id, body) {
        return waterline.nodes.needByIdentifier(id)
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
        return waterline.nodes.needByIdentifier(id);
    };

    NodeApiService.prototype.postNodeObmIdById = function(id, body) {
        // TODO: Make this a taskGraph instead once we improve multiple task
        // graph handling per node.
        return waterline.obms.findByNode(id, 'ipmi-obm-service', true)
            .then(function (settings) {
                if (settings) {
                    var obmService = ObmService.create(id, ipmiObmServiceFactory, settings);
                    if (body && body.value) {
                        return obmService.identifyOn(id);
                    } else {
                        return obmService.identifyOff(id);
                    }
                } else {
                    throw new Errors.NotFoundError(
                        'No IPMI OBM Settings Found (' + id + ').'
                    );
                }
            });
    };

    NodeApiService.prototype.getNodeSshById = function(id) {
        return waterline.nodes.getNodeById(id)
            .then(function (node) {
                if (node) {
                    return waterline.ibms.findAllByNode(id, false, {service: 'ssh-ibm-service'});
                }
            });
    };

    /**
     * Create an OBM for the specified Node id
     * @param  {String}     id
     * @param  {Object}     obm
     * @return {Promise}
     */
    NodeApiService.prototype.postNodeSshById = function(id, ibm) {
        return waterline.nodes.getNodeById(id)
            .then(function (node) {
                if (!node) {
                    throw new Errors.NotFoundError(
                        'Node not Found ' + id
                    );
                }
                return waterline.ibms.upsertByNode(id, ibm);
            });
    };

    NodeApiService.prototype.getNodeCatalogById = function(id, query) {
        return waterline.nodes.needByIdentifier(id)
            .then(function (node) {
                query = _.merge({ node: node.id }, query);
                return waterline.catalogs.find(query);
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

    NodeApiService.prototype.addToDhcpWhitelist = function (macAddr) {
        // TODO: add this to DHCP protocol and send over that exchange
        var whitelist = configuration.get('whitelist') || [];
        whitelist.push(macAddr.replace(/:/g, '-'));
        configuration.set('whitelist', whitelist);

        return whitelist;
    };

    NodeApiService.prototype.delFromDhcpWhitelist = function (macAddr) {
        // TODO: add this to DHCP protocol and send over that exchange
        var whitelist = configuration.get('whitelist');
        if (!_.isEmpty(whitelist)) {
            _.remove(whitelist, function(mac) {
                return mac === macAddr.replace(/:/g, '-');
            });
            configuration.set('whitelist', whitelist);
        }
    };

    NodeApiService.prototype.getNodeWorkflowById = function (id, query) {
        return waterline.nodes.needByIdentifier(id)
        .then(function () {
            return workflowApiService.getWorkflowsByNodeId(id, query);
        });
    };

    NodeApiService.prototype.setNodeWorkflow = function (configuration, id) {
        return workflowApiService.createAndRunGraph(configuration, id);
    };

    NodeApiService.prototype.setNodeWorkflowById = function(configuration, id) {
        return workflowApiService.createAndRunGraph(configuration, id);
    };

    NodeApiService.prototype.getActiveNodeWorkflowById = function(id) {
        return waterline.nodes.needByIdentifier(id)
        .then(function (node) {
            return workflowApiService.findActiveGraphForTarget(node.id);
        });
    };

    NodeApiService.prototype.delActiveWorkflowById = function (id) {
        return waterline.nodes.needByIdentifier(id)
        .then(function (node) {
            return workflowApiService.findActiveGraphForTarget(node.id);
        })
        .then(function(graph) {
            if (_.isEmpty(graph)) {
                throw new Errors.NotFoundError(
                    'No active workflow graph found for node ' + id
                );
            }
            console.log(graph);
            return [graph, workflowApiService.cancelTaskGraph(graph.instanceId)];
        })
        .spread(function(graph, graphId) {
            if (!graphId) {
                throw new Errors.NotFoundError(
                    'No active workflow instance ' +
                    graph.instanceId + ' found for node ' + id
                );
            } else {
                return graph;
            }
        });
    };

    /**
     * Add the tags to the specified node
     * @param  {String}     id
     * @param  {Array}      tags
     * @return {Promise}
     */
    NodeApiService.prototype.addTagsById = function(id, tags) {
        return Promise.resolve().then(function() {
            assert.ok(Array.isArray(tags), 'tags must be an array');
            assert.isMongoId(id, 'the id must be a valid mongo id');
        })
        .then(function() {
            return waterline.nodes.needByIdentifier(id);
        })
        .then(function () {
            return waterline.nodes.addTags(id, tags);
        })
        .then(function() {
            return tags;
        });
    };

    /**
     * Remove the tag from the specified node
     * @param  {String}     id
     * @param  {String}     tagName
     * @return {Promise}
     */
    NodeApiService.prototype.removeTagsById = function(id, tagName) {
        return Promise.resolve().then(function() {
            assert.string(tagName, 'tag must be a string');
            assert.isMongoId(id, 'the id must be a valid mongo id');
        })
        .then(function() {
            return waterline.nodes.needByIdentifier(id);
        })
        .then(function () {
            return waterline.nodes.remTags(id, tagName);
        })
        .then(function() {
            return tagName;
        });
    };

    /**
     * Remove the tag from a list of nodes
     * @param  {String}     tagName
     * @return {Promise}
     */
    NodeApiService.prototype.masterDelTagById = function(tagName) {
        return Promise.resolve().then(function() {
            assert.string(tagName, 'tag must be a string');
        })
        .then(function() {
            return waterline.nodes.findByTag(tagName);
        })
        .map(function(node) {
            return waterline.nodes.remTags(node.id, tagName)
                .then(function()
                {return node.id; });
        });
    };


    /**
     * Get a list of tags applied to the specified id
     * @param  {String}     id
     * @return {Promise}    Resolves to an array of tags
     */
    NodeApiService.prototype.getTagsById = function(id) {
        return Promise.resolve().then(function() {
            assert.isMongoId(id, 'the id must be a valid mongo id');
        })
        .then(function() {
            return waterline.nodes.needByIdentifier(id);
        })
        .then(function (node) {
            return node.tags;

        });
    };

    /**
     * Get a list of nodes with the tagName applied to them
     * @param  {String}     tagName
     * @return {Promise}    Resolves to an array of nodes
     */
    NodeApiService.prototype.getNodesByTag = function(tagName) {
        return Promise.resolve().then(function() {
            assert.string(tagName, 'tag must be a string');
        })
        .then(function() {
            return waterline.nodes.findByTag(tagName);
        });
    };

    /**
     * Get a list of all OBMs for the specified Node id
     * @param  {String}     id
     * @return {Promise}    Resolves to an array of OBMs
     */
    NodeApiService.prototype.getObmsByNodeId = function(id) {
        return waterline.nodes.getNodeById(id)
            .then(function (node){
                if (!node) {
                    throw new Errors.NotFoundError(
                        'Node not Found ' + id
                    );
                }
                return waterline.obms.findAllByNode(id, false);
            });
    };

    /**
     * Create an OBM for the specified Node id
     * @param  {String}     id
     * @param  {Object}     obm
     * @return {Promise}
     */
    NodeApiService.prototype.putObmsByNodeId = function(id, obm) {
        return waterline.nodes.getNodeById(id)
            .then(function (node) {
                if (!node) {
                    throw new Errors.NotFoundError(
                        'Node not Found ' + id
                    );
                }
                return waterline.obms.upsertByNode(id, obm);
            });
    };

    /**
     * Get a list of nodes with the tagName applied to them
     * @param  {String}     tagName
     * @return {Promise}    Resolves to an array of nodes
     */
    NodeApiService.prototype.getNodeByIdentifier = function(identifier) {
        return waterline.nodes.findByIdentifier(identifier);
    };

    return new NodeApiService();
}
