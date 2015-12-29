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
     * Find nodes downstream that relate with the removing node
     * @param  {Object}     node
     * @param  {Object}     type
     * @return {Promise}    array of downstream nodes
     */
    NodeApiService.prototype._findDsNodes = function(node, type) {
        // Find the enclosure nodes who enclose this compute node
        if (!_.has(node, 'relations')) {
            return Promise.resolve();
        }

        var relation = _.find(node.relations, { relationType: type });
        if (!relation || !_.has(relation, 'targets') ) {
            return Promise.resolve();
        }

        return Promise.map(relation.targets, function (dsNodeId) {
            return waterline.nodes.needByIdentifier(dsNodeId)
            .catch(function (err) {
                logger.warning("Error Getting Downstream Node with type " + type,
                    { error: err });
                return;
            });
        });
    };

    /**
     * Remove the relations to node in the downstram node. If the relation field is
     * empty after removing, delete this field.
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
     * Find out whether the specific type of relation is empty in node.
     * @param  {Object}     node
     * @param  {String}     type relation type
     * @return {Bool} true if the relation is empty and the node can be deleted
     */
    NodeApiService.prototype._findEmpty = function(node, type) {
        if (!node) {
            return false;
        }

        if (!_.has(node, 'relations')) {
            return true;
        }

        var index = _.findIndex(node.relations, { relationType: type });
        if (index === -1 || !_.has(node.relations[index], 'targets')) {
            return true;
        }

        return false;
    };

    /**
     * Handle downstream nodes. Update relation type field and remove downstream
     * node if needed.
     * @param  {Object}     dsNodos array of downstream nodes
     * @param  {Object}     type relation type in upstream node
     * @param  {Object}     nodeId upstream node id
     * @return {Promise}
     */
    NodeApiService.prototype._handleDsNodes = function(dsNodes, type, nodeId) {
        var self = this;
        var dsType = '';
        var delOption = null;

        if (Constants.NodeRelations.hasOwnProperty(type)) {
            dsType = Constants.NodeRelations[type].mapping;
            delOption = Constants.NodeRelations[type].delDsNodeOption;
        }

        return Promise.resolve()
        .then(function () {
            if (delOption === 'all') {
                // Throw error when all downstream nodes need to be deleted
                // but at least one of them have active workflow
                return Promise.map(dsNodes, function(dsNode) {
                    return self._delValidityCheck(dsNode.id);
                });
            }
        })
        .then(function () {
            return Promise.map(dsNodes, function (dsNode) {
                if (delOption === 'all') {
                    return self.removeNode(dsNode, dsType);
                } else {
                    return self._removeRelation(dsNode, dsType, nodeId)
                    .then(function (dsNode) {
                        if (dsNode) {
                            logger.debug('node updated', {id: dsNode.id, relation: dsType});
                            if (delOption === 'whenEmpty') {
                                return self._findEmpty(dsNode, dsType);
                            } else {
                                return false;
                            }
                        } else {
                            return false;
                        }
                    })
                    .then(function (del) {
                        if (del === true) {
                            return self.removeNode(dsNode, dsType);
                        }
                    });
                }
            });
        });
    };

    /**
     * Check whether a node has no active workflow and can be deleted
     * @param  {String}     nodeId
     * @return {Promise}
     */
    NodeApiService.prototype._delValidityCheck = function(nodeId) {
        return taskGraphProtocol.getActiveTaskGraph( { target: nodeId })
        .then(function (graph) {
            if (graph) {
                throw new Errors.BadRequestError('Could not remove node ' + nodeId +
                    ', active workflow is running');
            }
            return Promise.resolve();
        });
    };

    /**
     * Remove node related data and remove its relations with other nodes
     * @param  {Object}     node
     * @return {Promise}
     */
    NodeApiService.prototype.removeNode = function(node, srcType) {
        var self = this;

        return self._delValidityCheck(node.id)
        .then(function () {
            if (!node.hasOwnProperty('relations')) {
                return Promise.resolve;
            }

            return Promise.map(node.relations, function(relation) {

                var type = relation.relationType;

                // Skip handling relationType that comes from the upstream node
                // to avoid deleting upstream nodes more than once
                if (srcType && (srcType === type)) {
                    return Promise.resolve();
                }

                // Otherwise update its downstream node
                return self._findDsNodes(node, type)
                .then(function (dsNodes) {
                    return self._handleDsNodes(dsNodes, type, node.id);
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
