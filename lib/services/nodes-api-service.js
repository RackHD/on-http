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
        'Promise'
    )
);
function nodeApiServiceFactory(
    taskGraphProtocol,
    waterline,
    Errors,
    Logger,
    _,
    Promise
) {
    var logger = Logger.initialize(nodeApiServiceFactory);

    function NodeApiService() {
    }

    /**
     * Find Enclosure nodes which enclose compute node
     * @param  {Object}     node
     * @return {Promise}
     */
    NodeApiService.prototype._findEnclNodes = function(node) {
        // Find the enclosure nodes who enclose this compute node
        if (!_.has(node, 'relations')) {
            return Promise.resolve();
        }

        var relation = _.find(node.relations, { relationType: 'enclosedBy' });
        if (!relation || !_.has(relation, 'targets') ) {
            return Promise.resolve();
        }

        return Promise.map(relation.targets, function (enclNodeId) {
            return waterline.nodes.needByIdentifier(enclNodeId)
            .catch(function (err) {
                logger.warning("Error Getting Enclosure Node", { error: err });
                return;
            });
        });
    };

    /**
     * Remove the relations between node and enclosure node, if enclosure node
     * doesn't enclose any nodes, this enclosure node is also removed.
     * @param  {Object}     node
     * @param  {Array}      enclNodes
     * @return {Promise}
     */
    NodeApiService.prototype._removeEnclRelations = function(node, enclNodes) {
        if (!enclNodes) {
            return Promise.resolve();
        }

        // Remove the relationship between enclosure and compute node
        return Promise.map(enclNodes, function(enclNode) {
            if (!_.has(enclNode, 'relations')) {
                return;
            }

            var index = _.findIndex(enclNode.relations, { relationType: 'encloses' });
            if (index === -1 || !_.has(enclNode.relations[index], 'targets')) {
                return;
            }

            if (_.indexOf(enclNode.relations[index].targets, node.id) !== -1) {
                _.pull(enclNode.relations[index].targets, node.id);
            }
            // If Enclosure node doesn't have enclosed nodes
            // remove this enclosure node, else remove relationships
            if (enclNode.relations[index].targets.length === 0) {
                return waterline.nodes.destroy({ id: enclNode.id });
            } else {
                return waterline.nodes.updateByIdentifier(
                    enclNode.id, { relations : enclNode.relations });
            }
        });
    };

    /**
     * Remove node related data and remove its relations with other nodes
     * @param  {Object}     node
     * @return {Promise}
     */
    NodeApiService.prototype.removeNode = function(node) {
        var self = this;

        return taskGraphProtocol.getActiveTaskGraph( { target: node.id })
        .then(function (graph) {
            if (graph) {
                throw new Errors.BadRequestError('Could not remove node ' + node.id +
                    ', active workflow is running');
            }
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
            return self._findEnclNodes(node);
        })
        .then(function (enclNodes) {
            return self._removeEnclRelations(node, enclNodes);
        })
        .then(function () {
            return node;
        });
    };

    return new NodeApiService();
}
