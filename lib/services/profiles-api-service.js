// Copyright 2015-2016, EMC, Inc.

'use strict';

var di = require('di');

module.exports = profileApiServiceFactory;
di.annotate(profileApiServiceFactory, new di.Provide('Http.Services.Api.Profiles'));
di.annotate(profileApiServiceFactory,
    new di.Inject(
        'Promise',
        'Http.Services.Api.Workflows',
        'Protocol.Task',
        'Protocol.Events',
        'Services.Waterline',
        'Services.Configuration',
        'Services.Lookup',
        'Logger',
        'Errors',
        '_'
    )
);
function profileApiServiceFactory(
    Promise,
    workflowApiService,
    taskProtocol,
    eventsProtocol,
    waterline,
    configuration,
    lookupService,
    Logger,
    Errors,
    _
) {

    var logger = Logger.initialize(profileApiServiceFactory);

    function ProfileApiService() {
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
        return _.flattenDeep([macs]);
    };

    ProfileApiService.prototype.setLookup = function(query) {
        if (query.mac && query.ip) {
            return waterline.nodes.findByIdentifier(this.getMacs(query.mac))
            .then(function (node) {
                if (_.isUndefined(node)) {
                    return lookupService.setIpAddress(
                        query.ip,
                        query.mac
                    );
                }
            });
        }
        return Promise.resolve();
    };

    ProfileApiService.prototype.getNode = function(macAddresses, options) {
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
                            return self.runDiscovery(node, options);
                        });
                    } else {
                        // We only count a node as having been discovered if
                        // a node document exists AND it has any catalogs
                        // associated with it
                        return node;
                    }

                });
            } else {
                return self.createNodeAndRunDiscovery(macAddresses, options);
            }
        });
    };

    ProfileApiService.prototype.runDiscovery = function(node, options) {
        var self = this;
        var configuration;

        if (options && options.type === 'switch') {
            configuration = self.getSwitchDiscoveryConfiguration(node, options.switchVendor);
        } else {
            configuration = {
                name: 'Graph.SKU.Discovery',
                options: {
                    defaults: {
                        graphOptions: {
                            target: node.id
                        },
                        nodeId: node.id
                    }
                }
            };
        }

        return workflowApiService.createAndRunGraph(configuration)
        .then(function() {
            return self.waitForDiscoveryStart(node.id);
        })
        .then(function() {
            return node;
        });
    };

    ProfileApiService.prototype.getSwitchDiscoveryConfiguration = function(node, vendor) {
        var configuration = {
            options: {
                // TODO: figure out once the graphs are defined
                // defaults: {
                //     graphOptions: {
                //         target: node.id
                //     },
                //     nodeId: node.id
                // }
            }
        };

        vendor = vendor.toLowerCase();

        if (vendor === 'cisco') {
            configuration.name = 'Graph.Switch.Discovery.Cisco';
        } else if (vendor === 'arista') {
            configuration.name = 'Graph.Switch.Discovery.Arista';
        } else {
            throw new Errors.BadRequestError('Unknown switch vendor ' + vendor);
        }

        return configuration;
    };

    ProfileApiService.prototype.createNodeAndRunDiscovery = function(macAddresses, options) {
        var self = this;
        var node;
        return waterline.nodes.create({
            name: macAddresses.join(','),
            identifiers: macAddresses,
            type: options.type
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

            return self.runDiscovery(node, options);
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


    ProfileApiService.prototype.renderProfileFromTaskOrNode = function(node) {
        var self = this;
        return workflowApiService.findActiveGraphForTarget(node.id)
        .then(function (taskgraphInstance) {
            if (taskgraphInstance) {
                return Promise.props({
                    profile: taskProtocol.requestProfile(node.id),
                    properties: taskProtocol.requestProperties(node.id),
                    context: taskgraphInstance.context
                })
            } else {
                return Promise.resolve({
                    profile: _.get(node, 'bootSettings.profile', 'error.ipxe'),
                    options: _.get(node, 'bootSettings.options', {
                        error: 'Unable to retrieve node bootSettings'
                    })
                });
            }
        })
        .then(function(obj) {
            return {
                profile: obj.profile || 'redirect.ipxe',
                options: obj.properties ? self.convertProperties(obj.properties) : obj.options
            }
        })
        .catch(function (e) {
            logger.warning("Unable to retrieve workflow properties.", {
                error: e,
                id: node.id
            });
            return {
                profile: 'error.ipxe',
                options: {
                    error: 'Unable to retrieve workflow properties.'
                }
            };
        });
    };

    return new ProfileApiService();
}
