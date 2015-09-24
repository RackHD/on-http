// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    express = require('express');

module.exports = obmRouterFactory;

di.annotate(obmRouterFactory,
    new di.Inject(
        'Promise',
        'Http.Services.RestApi',
        '_'
    )
);

function obmRouterFactory (Promise, rest, _) {
    var router = express.Router();

    // TODO: Get this from the forthcoming Obm Service Manager.
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
     * @api {get} /api/1.1/obms/library GET /library
     * @apiVersion 1.1.0
     * @apiDescription get list of possible OBM services
     * @apiName obms-library-get
     * @apiGroup obms
     * @apiSuccess {json} obms list of the available obms.
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 500 Error
     *     {
     *       "error": "File upload failed."
     *     }
     */

    router.get('/obms/library', rest(function () {
        return obms;
    }));

    /**
     * @api {get} /api/1.1/obms/library/:identifier GET /library/:identifier
     * @apiVersion 1.1.0
     * @apiDescription get a single OBM service
     * @apiName obms-library-service-get
     * @apiGroup obms
     * @apiParam {String} identifier The obm service name.
     * @apiParamExample {String }Identifier-Example:
     *      "amt-obm-service"
     * @apiError NotFound There is no obm in the library <code>identifier</code>
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *     }
     */

    router.get('/obms/library/:identifier', rest(function (req) {
        return _.detect(obms, { service: req.params.identifier });
    }));

    return router;
}
