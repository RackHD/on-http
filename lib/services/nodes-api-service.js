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
        'Constants'
    )
);
function nodeApiServiceFactory(
    taskGraphProtocol,
    waterline,
    Errors,
    Logger,
    _,
    Promise,
    Constants
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

    return new NodeApiService();
}
