// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node: true */

'use strict';

var di = require('di'),
    express = require('express');

module.exports = obmRouterFactory;

di.annotate(obmRouterFactory,
    new di.Inject(
        'Q',
        'common-api-presenter',
        '_'
    )
);

function obmRouterFactory (Q, presenter, _) {
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
     * @api {get} /api/common/obms/library GET /library
     * @apiDescription get list of possible OBM services
     * @apiName obms-library-get
     * @apiGroup obms
     */

    router.get('/obms/library', presenter.middleware(obms));

    /**
     * @api {get} /api/common/obms/library/:identifier GET /library/:identifier
     * @apiDescription get a single OBM service
     * @apiName obms-library-service-get
     * @apiGroup obms
     */

    router.get('/obms/library/:identifier', presenter.middleware(function (req) {
        return _.detect(obms, { service: req.param('identifier') });
    }));

    return router;
}
