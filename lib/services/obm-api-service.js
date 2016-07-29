// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di');

module.exports = obmApiServiceFactory;
di.annotate(obmApiServiceFactory, new di.Provide('Http.Services.Api.Obms'));
di.annotate(obmApiServiceFactory,
    new di.Inject(
        'Services.Waterline',
        'Logger',
        'Protocol.Events',
        'Promise',
        '_'
    )
);
function obmApiServiceFactory(
    waterline,
    Logger,
    eventsProtocol,
    Promise,
    _

) {
    var logger = Logger.initialize(obmApiServiceFactory);

    function ObmApiService() {
    }

    var obms = [
        {
            service: 'amt-obm-service',
            config: {
                host: {
                    default: 'localhost',
                    type: 'string'
                },
                password: {
                    default: 'admin',
                    type: 'string'
                }
            }
        },
        {
            service: 'apc-obm-service',
            config: {
                host: {
                    default: 'localhost',
                    type: 'string'
                },
                community: {
                    default: 'admin',
                    type: 'string'
                },
                port: {
                    default: 1,
                    type: 'integer'
                }
            }
        },
        {
            service: 'ipmi-obm-service',
            config: {
                host: {
                    default: 'localhost',
                    type: 'string'
                },
                user: {
                    default: 'admin',
                    type: 'string'
                },
                password: {
                    default: 'admin',
                    type: 'string'
                }
            }
        },
        {
            service: 'noop-obm-service',
            config: {
            }
        },
        {
            service: 'raritan-obm-service',
            config: {
                host: {
                    default: 'localhost',
                    type: 'string'
                },
                user: {
                    default: 'admin',
                    type: 'string'
                },
                password: {
                    default: 'admin',
                    type: 'string'
                },
                port: {
                    default: 1,
                    type: 'integer'
                }
            }
        },
        {
            service: 'servertech-obm-service',
            config: {
                host: {
                    default: 'localhost',
                    type: 'string'
                },
                community: {
                    default: 'admin',
                    type: 'string'
                },
                port: {
                    default: 1,
                    type: 'integer'
                }
            }
        },
        {
            service: 'panduit-obm-service',
            config: {
                //host/community/cyclePassword outside the pduOutlets array will
                //apply to all PDU outlets defined inside the pduOutlets array.
                //They will be overrode by the host/community/cyclePassword defined
                //inside the pduOutlets array.
                host: {
                    default: 'localhost',
                    type: 'string'
                },
                community: {
                    default: 'admin',
                    type: 'string'
                },
                cyclePassword: {
                    default: 'onrack',
                    type: 'string'
                },
                pduOutlets: [
                    //host/community/cyclePassword defined inside pduOutlets array are optional.
                    //They will override the settings above, if they exist inside the array below.
                    //In this case, different outlets for a node can be distributed into different
                    //IPI PDU for full-failover configurations.
                    //By default, the cyclePassword for each outlet is a string of
                    // 'A<outlet_number>' outlet_number is a double-digital number,
                    // ie. 00, 01, 12, 24.
                    {
                        host: {
                            default: 'localhost',
                            type: 'string'
                        },
                        community: {
                            default: 'admin',
                            type: 'string'
                        },
                        cyclePassword: {
                            default: 'A01',
                            type: 'string'
                        },
                        pduNumber: {
                            default: 1,
                            type: 'integer'
                        },
                        outletNumber: {
                            default: 1,
                            type: 'integer'
                        }
                    },
                    {
                        host: {
                            default: 'localhost',
                            type: 'string'
                        },
                        community: {
                            default: 'admin',
                            type: 'string'
                        },
                        cyclePassword: {
                            default: 'A01',
                            type: 'string'
                        },
                        pduNumber: {
                            default: 2,
                            type: 'integer'
                        },
                        outletNumber: {
                            default: 1,
                            type: 'integer'
                        }
                    },
                ]
            }
        },
        {
            service: 'vbox-obm-service',
            config: {
                alias: {
                    default: 'client',
                    type: 'string'
                },
                user: {
                    default: 'root',
                    type: 'string'
                }
            }
        },
        {
            service: 'vmrun-obm-service',
            config: {
                vmxpath: {
                    default: '/tmp/vm.vmx',
                    type: 'string'
                }
            }
        },
    ];

    /**
     */
    ObmApiService.prototype.getObmLib = function() {
        return obms;
    };

    /**
     * Get specific obm details
     * @param identifier [req.params.identifier] HTTP request
     * @return {Promise}
     */
    ObmApiService.prototype.getObmLibById = function(id) {
        return _.detect(obms, { service: id });
    };

    /**
     * Update obm by identifier
     * @param obmId     Obm identifier 
     * @param values    Values to be updated
     * @return {Promise}
     */
    ObmApiService.prototype.updateObmById = function(obmId, values) {
        return waterline.obms.needByIdentifier(obmId)
        .then(function(oldObm) {
            /* Get nodes that need to publish events */
            if (oldObm.node && !values.nodeId) {
                return Promise.all([waterline.nodes.getNodeById(oldObm.node)]);
            } else if (!oldObm.node && values.nodeId) {
                return Promise.all([waterline.nodes.getNodeById(values.node)]);
            } else if (oldObm.node && values.nodeId && oldObm.node === values.nodeId) {
                return Promise.all([waterline.nodes.getNodeById(oldObm.node)]);
            } else if (oldObm.node && values.nodeId && oldObm.node !== values.nodeId) {
                return Promise.all([waterline.nodes.getNodeById(oldObm.node),
                        waterline.nodes.getNodeById(values.nodeId)]);
            }
        })
        .then(function(oldNodes) {
            return waterline.obms.updateByIdentifier(obmId, values)
            .tap(function() {
                /* Publish events of nodes got beofre update */
                _.forEach(oldNodes, function(oldNode) {
                    if (oldNode) {
                        /* asynchronous, don't wait promise return for performance*/
                        return waterline.nodes.getNodeById(oldNode.id)
                        .then(function(newNode) {
                            return eventsProtocol.publishNodeAttrEvent(oldNode, newNode, 'obms');
                        })
                        .catch(function (error) {
                            logger.error('Error occurs', error);
                        });
                    }
                });
            });
        });
    };

    /**
     * Delete obm by identifier
     * @param obmId     Obm identifier 
     * @return {Promise}
     */
    ObmApiService.prototype.removeObmById = function(obmId) {
        return waterline.obms.needByIdentifier(obmId)
        .then(function (obm) {
            return waterline.nodes.getNodeById(obm.node);
        })
        .then(function (oldNode) {
            return waterline.obms.destroyByIdentifier(obmId)
            .tap(function () {
                if (oldNode) {
                    /* asynchronous, don't wait promise return for performance*/
                    waterline.nodes.getNodeById(oldNode.id)
                    .then(function (newNode) {
                        return eventsProtocol.publishNodeAttrEvent(oldNode, newNode, 'obms');
                    })
                    .catch(function (error) {
                        logger.error('Error occurs', error);
                    });
                }
            });
        });
    };

    return new ObmApiService();
}
