// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di');

module.exports = obmApiServiceFactory;
di.annotate(obmApiServiceFactory, new di.Provide('Http.Services.Api.Obms'));
di.annotate(obmApiServiceFactory,
    new di.Inject(
        'Promise',
        '_'
    )
);
function obmApiServiceFactory(
    Promise,
    _

) {

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

    return new ObmApiService();
}
