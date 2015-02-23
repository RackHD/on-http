// Copyright 2014-2015, Renasar Technologies Inc.
/*jslint node: true */
'use strict';

var di = require('di'),
    express = require('express'),
    parser = require('body-parser');

module.exports = pollerRouterFactory;

di.annotate(pollerRouterFactory,
    new di.Inject(
        'Services.Waterline',
        'common-api-presenter',
        'Protocol.Task',
        'Constants',
        'Q',
        '_'
    )
);

/**
 * pollerRouterFactory extends the express router with the additional routes
 * specific to devices.  Uses the provided or injected dependencies to do so.
 * @private
 * @param {DomainService} domainService instance of the data service
 * @param {PollerService} pollerService instance of the poller service
 * @param presenter
 * @param {Q} Q
 * @returns {Router} returns the router that has been extended with our verbs
 */
function pollerRouterFactory (waterline, presenter, taskProtocol, Constants, Q, _) {
    var router = express.Router();
    var pollerLibrary = [
        {
            name: 'ipmi',
            node: true,
            config: [
                {
                    key: 'host',
                    type: 'string'
                },
                {
                    key: 'user',
                    type: 'string',
                    defaultsTo: 'admin'
                },
                {
                    key: 'password',
                    type: 'string',
                    defaultsTo: 'admin'
                },
                {
                    key: 'alerts',
                    type: 'json',
                    required: false
                }
            ]
        },
        {
            name: 'snmp',
            config: [
                {
                    key: 'host',
                    type: 'string',
                    required: true
                },
                {
                    key: 'communityString',
                    type: 'string',
                    required: true
                },
                {
                    key: 'extensionMibs',
                    type: 'string[]'
                }
            ]
        }
    ];

    /**
     * @api {get} /api/1.1/pollers/library GET /library
     * @apiVersion 1.1.0
     * @apiDescription get list of possible pollers services
     * @apiName pollers-library-get
     * @apiGroup pollers
     * @apiSuccess {json} pollers list of the available library pollers.
     */

    router.get('/pollers/library', presenter.middleware(pollerLibrary));


    /**
     * @api {get} /api/1.1/pollers/library/:identifier GET /library/:identifier
     * @apiVersion 1.1.0
     * @apiDescription get a single poller
     * @apiName pollers-library-service-get
     * @apiGroup pollers
     * @apiParamExample {String }Identifier-Example:
     *      "ipmi"
     * @apiError NotFound There is no poller in the library with <code>identifier</code>
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *     }
     */

    router.get('/pollers/library/:identifier', presenter.middleware(function (req) {
        return _.detect(pollerLibrary, { name: req.param('identifier') });
    }));

    var pollerWorkItems = {
        ipmi: Constants.WorkItems.Pollers.IPMI,
        snmp: Constants.WorkItems.Pollers.SNMP
    };

    function unpresenterMiddleware(func) {
        return function (req, res, next) {
            Q.resolve(func(req.body)).then(function (value) {
                req.body = value;
                next();
            }).catch(function (err) {
                return presenter(req, res).render(Q.reject(err));
            });
        };
    }

    function deserializePoller(poller) {
        if (poller) {
            if (poller.type) {
                poller.name = pollerWorkItems[poller.type];
            }
            poller = _.pick(poller, 'name', 'node', 'config', 'pollInterval');
        }
        return poller;
    }

    function serializePoller(poller) {
        if (poller) {
            poller.type = _.findKey(pollerWorkItems, function (workItem) {
                return workItem === poller.name;
            });
            delete poller.name;
        }
        return poller;
    }

    presenter.use('poller', function (value) {
        if (Array.isArray(value)) {
            return _.map(value, serializePoller);
        }
        return serializePoller(value);
    });

    /**
     * @api {get} /api/1.1/pollers GET /
     * @apiVersion 1.1.0
     * @apiDescription get a list of all pollers
     * @apiName pollers-get
     * @apiGroup pollers
     * @apiSuccess {json} pollers list of pollers or an empty object if there are none.
     */

    router.get('/pollers', presenter.middleware(function (req) {
        return waterline.workitems.findPollers(req.query);
    }, { serializer: 'poller' }));

    /**
     * @api {get} /api/1.1/pollers/:identifier GET /:identifier
     * @apiVersion 1.1.0
     * @apiDescription Get specifics of the specified poller.
     * @apiName poller-get
     * @apiGroup pollers
     * @apiParam {String} identifier String representation of the ObjectId
     * @apiSuccess {json} poller the poller with the <code>id</code>
     * @apiError identifierNotFound The <code>identifier</code> could not be found.
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *     }
     */

    router.get('/pollers/:identifier', presenter.middleware(function (req) {
        return waterline.workitems.findByIdentifier(req.param('identifier'));
    }, { serializer: 'poller' }));


    /**
     * @api {post} /api/1.1/pollers POST /
     * @apiVersion 1.1.0
     * @apiDescription create a poller
     * @apiName pollers-create
     * @apiGroup pollers
     * @apiError E_VALIDATION invalid Attributes.
     * @apiErrorExample E_VALIDATION:
     * {
     *   "error": "E_VALIDATION",
     *   "status": 400,
     *   "summary": "1 attributes are invalid",
     *   "model": "workitems",
     *   "invalidAttributes": {
     *       "pollInterval": [
     *           {
     *               "rule": "integer",
     *               "message": "`undefined` should be a integer (instead of \"null\", which is a object)"
     *           },
     *           {
     *               "rule": "required",
     *               "message": "\"required\" validation rule failed for input: null"
     *           }
     *       ]
     *   }
     * }
     */

    router.post('/pollers',
                parser.json(),
                unpresenterMiddleware(deserializePoller),
                presenter.middleware(function (req) {
        return waterline.workitems.create(req.body);
    }, { serializer: 'poller' }));


    /**
     * @api {patch} /api/1.1/pollers/:identifier PATCH /:identifier
     * @apiVersion 1.1.0
     * @apiDescription update a poller
     * @apiName pollers-update
     * @apiGroup pollers
     * @apiParam {String} identifier String representation of the ObjectId
     * @apiSuccess {json} poller the patched poller with the <code>id</code>
     * @apiError NotFound The <code>identifier</code> could not be found.
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *     }
     */

    router.patch('/pollers/:identifier',
                 parser.json(),
                 unpresenterMiddleware(deserializePoller),
                 presenter.middleware(function (req) {
        return waterline.workitems.updateByIdentifier(req.param('identifier'), req.body);
    }, { serializer: 'poller' }));


    /**
     * @api {delete} /api/1.1/pollers/:identifier DELETE /:id
     * @apiVersion 1.1.0
     * @apiDescription Delete all pollers of specified device.
     * @apiName poller-delete
     * @apiGroup pollers
     * @apiParam {String} identifier String representation of the ObjectId
     * @apiSuccess {nothing} nothing it doesn't return anything if Successful
     * @apiError NotFound The <code>identifier</code> could not be found.
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *     }
     */

    router.delete('/pollers/:identifier', presenter.middleware(function (req) {
        return waterline.workitems.destroyByIdentifier(
            req.param('identifier')
        );
    }, { success: 204, serializer: 'poller' }));

    /**
     * @api {get} /api/1.1/pollers/:identifier/data GET /:identifier/data
     * @apiVersion 1.1.0
     * @apiDescription Get data for the specific poller.
     * @apiName poller-get-data
     * @apiGroup pollers
     * @apiParam {String} identifier (ip address or NodeId) for the data from a poller
     * @apiError NotFound1 The <code>identifier</code> could not be found.
     * @apiError NotFound2 There is no data for the poller with the <code>identifier</code>.
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *     }
     */

    router.get('/pollers/:identifier/data', presenter.middleware(function(req) {
        return taskProtocol.requestPollerCache(req.param('identifier'));
    }));

    return router;
}
