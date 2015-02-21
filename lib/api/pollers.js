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
     * @apiDescription get list of possible pollers services
     * @apiName pollers-library-get
     * @apiGroup pollers
     */

    router.get('/pollers/library', presenter.middleware(pollerLibrary));

    /**
     * @api {get} /api/1.1/pollers/library/:identifier GET /library/:identifier
     * @apiDescription get a single OBM service
     * @apiName pollers-library-service-get
     * @apiGroup pollers
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
     * @apiDescription get a list of all pollers
     * @apiName pollers-get
     * @apiGroup pollers
     */

    router.get('/pollers', presenter.middleware(function (req) {
        return waterline.workitems.findPollers(req.query);
    }, { serializer: 'poller' }));

    /**
     * @api {get} /api/1.1/pollers/:identifier GET /:identifier
     * @apiDescription Get specifics of the specified poller.
     * @apiName poller-get
     * @apiGroup pollers
     * @apiParam {String} identifier String representation of the ObjectId
     * @apiError identifierCastFailed The id could not be cast to ObjectId.
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "identifierCastFailed"
     *     }
     * @apiError identifierNotFound The identifier could not be found.
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "identifierNotFound"
     *     }
     */

    router.get('/pollers/:identifier', presenter.middleware(function (req) {
        return waterline.workitems.findByIdentifier(req.param('identifier'));
    }, { serializer: 'poller' }));

    /**
     * @api {post} /api/1.1/pollers POST /
     * @apiDescription create a poller
     * @apiName pollers-create
     * @apiGroup pollers
     */

    router.post('/pollers',
                parser.json(),
                unpresenterMiddleware(deserializePoller),
                presenter.middleware(function (req) {
        return waterline.workitems.create(req.body);
    }, { serializer: 'poller' }));

    /**
     * @api {patch} /api/1.1/pollers/:identifier PATCH /:identifier
     * @apiDescription update a poller
     * @apiName pollers-update
     * @apiGroup pollers
     * @apiParam {String} identifier String representation of the ObjectId
     */

    router.patch('/pollers/:identifier',
                 parser.json(),
                 unpresenterMiddleware(deserializePoller),
                 presenter.middleware(function (req) {
        return waterline.workitems.updateByIdentifier(req.param('identifier'), req.body);
    }, { serializer: 'poller' }));

    /**
     * @api {delete} /api/1.1/pollers/:identifier DELETE /:id
     * @apiDescription Delete all pollers of specified device.
     * @apiName poller-delete
     * @apiGroup pollers
     * @apiParam {String} identifier String representation of the ObjectId
     */

    router.delete('/pollers/:identifier', presenter.middleware(function (req) {
        return waterline.workitems.destroyByIdentifier(
            req.param('identifier')
        );
    }, { success: 204, serializer: 'poller' }));

    /**
     * @api {get} /api/1.1/pollers/:identifier/data GET /:identifier/data
     * @apiDescription Get data for the specific poller.
     * @apiName poller-get-data
     * @apiGroup pollers
     * @apiParam {String} identifier (ip address or NodeId) for the data from a poller
     */

    router.get('/pollers/:identifier/data', presenter.middleware(function(req) {
        return taskProtocol.requestPollerCache(req.param('identifier'));
    }));

    return router;
}
