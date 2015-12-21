// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di');

module.exports = profileApiServiceFactory;
di.annotate(profileApiServiceFactory, new di.Provide('Http.Services.Api.Profiles'));
di.annotate(profileApiServiceFactory,
    new di.Inject(
        'Promise',
        'Protocol.TaskGraphRunner',
        'Protocol.Task',
        'Protocol.Events',
        'Services.Waterline',
        'Services.Configuration',
        'Logger',
        'Errors',
        '_'
    )
);
function profileApiServiceFactory(
    Promise,
    taskGraphProtocol,
    taskProtocol,
    eventsProtocol,
    waterline,
    configuration,
    Logger,
    Errors,
    _
) {

    var logger = Logger.initialize(profileApiServiceFactory);

    function ProfileApiService() {
        this.activeNodeGraphs = 0;
        this.maxNodeGraphs = configuration.get('maxNodeGraphs', 30);
        this.nodesRetrying = {};
    }

    // Helper to convert property kargs into an ipxe friendly string.
    ProfileApiService.prototype.convertProperties = function(properties) {
        properties = properties || {};

        if (properties.hasOwnProperty('kargs')) {
            // This a promotion of the kargs property
            // for DOS disks (or linux) for saving
            // the trouble of having to write a
            // bunch of code in the EJS template.
            properties.kargs = _.map(
                properties.kargs, function (value, key) {
                return key + '=' + value;
            }).join(' ');
        } else {
            // Ensure kargs is set for rendering.
            properties.kargs = null;
        }

        return properties;
    };

    ProfileApiService.prototype.getMacs = function(macs) {
        return _.flatten([macs]);
    };

    ProfileApiService.prototype.getNode = function(macAddresses) {
        var self = this;
        return waterline.nodes.findByIdentifier(macAddresses)
        .then(function (node) {
            if (node) {
                return node.discovered()
                .then(function(discovered) {
                    if (!discovered) {
                        return taskProtocol.activeTaskExists(node.id)
                        .then(function() {
                            return node;
                        })
                        .catch(function() {
                            return self.runDiscovery(node);
                        });
                    } else {
                        // We only count a node as having been discovered if
                        // a node document exists AND it has any catalogs
                        // associated with it
                        return node;
                    }

                });
            } else {
                return self.createNodeAndRunDiscovery(macAddresses);
            }
        });
    };

    ProfileApiService.prototype.runDiscovery = function(node) {
        var self = this;

        if (self.activeNodeGraphs >= self.maxNodeGraphs) {
            var err = new Errors.MaxGraphsRunningError();
            if (self.nodesRetrying[node.id]) {
                err.retryLater = true;
                return Promise.reject(err);
            } else {
                self.nodesRetrying[node.id] = true;
                err.retryLater = false;
                return Promise.reject(err);
            }
        }

        delete self.nodesRetrying[node.id];
        self.activeNodeGraphs += 1;

        var options = {
            defaults: {
                graphOptions: {
                    target: node.id
                },
                nodeId: node.id
            }
        };

        return taskGraphProtocol.runTaskGraph('Graph.SKU.Discovery', options, undefined)
        .catch(function(err) {
            self.activeNodeGraphs -= 1;
            throw err;
        })
        .then(function(graph) {
            eventsProtocol.subscribeGraphFinished(graph.instanceId, function() {
                self.activeNodeGraphs -= 1;
            });
            return self.waitForDiscoveryStart(node.id);
        })
        .then(function() {
            return node;
        });
    };

    ProfileApiService.prototype.createNodeAndRunDiscovery = function(macAddresses) {
        var self = this;
        var node;
        return waterline.nodes.create({
            name: macAddresses.join(','),
            identifiers: macAddresses
        })
        .then(function (_node) {
            node = _node;

            return Promise.resolve(macAddresses).each(function (macAddress) {
                return waterline.lookups.upsertNodeToMacAddress(node.id, macAddress);
            });
        })
        .then(function () {
            // Setting newRecord to true allows us to
            // render the redirect again to avoid refresh
            // of the node document and race conditions with
            // the state machine changing states.
            node.newRecord = true;

            return self.runDiscovery(node);
        });
    };

    // Quick and dirty extra two retries for the discovery graph, as the
    // runTaskGraph promise gets resolved before the tasks themselves are
    // necessarily started up and subscribed to bus events.
    ProfileApiService.prototype.waitForDiscoveryStart = function(nodeId) {
        var retryRequestProperties = function(error) {
            if (error instanceof Errors.RequestTimedOutError) {
                return taskProtocol.requestProperties(nodeId);
            } else {
                throw error;
            }
        };

        return taskProtocol.requestProperties(nodeId)
        .catch(retryRequestProperties)
        .catch(retryRequestProperties);
    };

    ProfileApiService.prototype.renderProfileFromTask = function(node) {
        var self = this;
        return taskGraphProtocol.getActiveTaskGraph({ target: node.id })
        .then(function (taskgraphInstance) {
            if (taskgraphInstance) {
                return taskProtocol.requestProfile(node.id)
                .then(function(profile) {
                    return [profile, taskProtocol.requestProperties(node.id)];
                })
                .spread(function (profile, properties) {
                    return {
                        profile: profile || 'redirect.ipxe',
                        options: self.convertProperties(properties)
                    };
                })
                .catch(function (e) {
                    logger.warning("Unable to retrieve workflow properties.", {
                        error: e,
                        id: node.id,
                        taskgraphInstance: taskgraphInstance
                    });
                    return {
                        profile: 'error.ipxe',
                        options: {
                            error: 'Unable to retrieve workflow properties.'
                        }
                    };
                });
            } else {
                return {
                    profile: 'error.ipxe',
                    options: {
                        error: 'Unable to locate active workflow.'
                    }
                };
            }
        });
    };

    return new ProfileApiService();
}
