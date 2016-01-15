// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    express = require('express');

module.exports = pollerRouterFactory;

di.annotate(pollerRouterFactory,
    new di.Inject(
        'Services.Waterline',
        'Http.Services.RestApi',
        'Protocol.Task',
        'Constants',
        'Promise',
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
 * @param {Promise} Promise
 * @returns {Router} returns the router that has been extended with our verbs
 */
function pollerRouterFactory (waterline, rest, taskProtocol, Constants, Promise, _) {
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

    router.get('/pollers/library', rest(function () {
        return pollerLibrary;
    }));


    /**
     * @api {get} /api/1.1/pollers/library/:identifier GET /library/:identifier
     * @apiVersion 1.1.0
     * @apiDescription get a single poller
     * @apiName pollers-library-service-get
     * @apiGroup pollers
     * @apiParam {String} identifier String representation of the ObjectId
     * @apiParamExample {String} Identifier-Example:
     *      "ipmi"
     * @apiSuccess {json} poller the specfied poller library
     * @apiError NotFound There is no poller in the library with <code>identifier</code>
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *     }
     */

    router.get('/pollers/library/:identifier', rest(function (req) {
        return _.detect(pollerLibrary, { name: req.params.identifier });
    }));

    var pollerWorkItems = {
        ipmi: Constants.WorkItems.Pollers.IPMI,
        snmp: Constants.WorkItems.Pollers.SNMP
    };

    function deserializePoller(poller) {
        if (poller) {
            if (poller.type) {
                poller.name = pollerWorkItems[poller.type];
            }
            poller = _.pick(poller, 'name', 'node', 'config', 'pollInterval', 'paused');
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
        return waterline.workitems.deserialize(poller);
    }

    /**
     * @api {get} /api/1.1/pollers GET /
     * @apiVersion 1.1.0
     * @apiDescription get a list of all pollers
     * @apiName pollers-get
     * @apiGroup pollers
     * @apiSuccess {json} pollers list of pollers or an empty object if there are none.
     */

    router.get('/pollers', rest(function (req) {
        return waterline.workitems.findPollers(req.query);
    }, { serializer: serializePoller, isArray: true }));

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

    router.get('/pollers/:identifier', rest(function (req) {
        return waterline.workitems.needByIdentifier(req.params.identifier);
    }, {
        serializer: serializePoller
    }));


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
     *               "message":
     *                   "`undefined` should be a integer (instead of \"null\", which is a object)"
     *           },
     *           {
     *               "rule": "required",
     *               "message": "\"required\" validation rule failed for input: null"
     *           }
     *       ]
     *   }
     * }
     */

    router.post('/pollers', rest(function (req) {
        return waterline.workitems.create(req.body);
    }, {
        serializer: serializePoller,
        deserializer: deserializePoller
    }));


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

    router.patch('/pollers/:identifier', rest(function (req) {
        return waterline.workitems.updateByIdentifier(req.params.identifier, req.body);
    }, {
        serializer: serializePoller,
        deserializer: deserializePoller
    }));


    /**
     * @api {patch} /api/1.1/pollers/:identifier/pause PATCH /:identifier/pause
     * @apiVersion 1.1.0
     * @apiDescription pause a poller
     * @apiName pollers-pause
     * @apiGroup pollers
     * @apiParam {String} identifier String representation of the ObjectId
     * @apiSuccess {json} poller the paused poller with the <code>id</code>
     * @apiError NotFound The <code>identifier</code> could not be found.
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *     }
     */

    router.patch('/pollers/:identifier/pause', rest(function (req) {
        return waterline.workitems.updateByIdentifier(req.params.identifier, { paused: true });
    }, {
        serializer: serializePoller,
        deserializer: deserializePoller
    }));

    /**
     * @api {patch} /api/1.1/pollers/:identifier/resume PATCH /:identifier/resume
     * @apiVersion 1.1.0
     * @apiDescription resume a paused poller
     * @apiName pollers-resume
     * @apiGroup pollers
     * @apiParam {String} identifier String representation of the ObjectId
     * @apiSuccess {json} poller the unpaused poller with the <code>id</code>
     * @apiError NotFound The <code>identifier</code> could not be found.
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *     }
     */

    router.patch('/pollers/:identifier/resume', rest(function (req) {
        return waterline.workitems.updateByIdentifier(req.params.identifier, { paused: false });
    }, {
        serializer: serializePoller,
        deserializer: deserializePoller
    }));

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

    router.delete('/pollers/:identifier', rest(function (req) {
        return waterline.workitems.destroyByIdentifier(
            req.params.identifier
        );
    }, { renderOptions: { success: 204 }, serializer: serializePoller }));

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

    router.get('/pollers/:identifier/data', rest(function(req) {
        return taskProtocol.requestPollerCache(req.params.identifier);
    }));

    /**
     * @api {get} /api/1.1/pollers/:identifier/data/current GET /:identifier/data/current
     * @apiVersion 1.1.0
     * @apiDescription Get only the most recent data entry for the specific poller.
     * @apiName poller-get-data-current
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

    router.get('/pollers/:identifier/data/current', rest(function(req) {
        return taskProtocol.requestPollerCache(req.params.identifier, { latestOnly: true });
    }));

    return router;
}
