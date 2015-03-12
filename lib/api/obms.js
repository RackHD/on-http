// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node: true */

'use strict';

var di = require('di'),
    express = require('express');

module.exports = obmRouterFactory;

di.annotate(obmRouterFactory,
    new di.Inject(
        'Q',
        'Http.Services.RestApi',
        '_'
    )
);

function obmRouterFactory (Q, rest, _) {
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
