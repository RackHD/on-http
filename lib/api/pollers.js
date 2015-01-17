// Copyright 2014-2015, Renasar Technologies Inc.
/*jslint node: true */
'use strict';

var di = require('di'),
    _ = require('lodash'),
    express = require('express'),
    parser = require('body-parser'),
    router = express.Router();

router.use(parser.json());

module.exports = pollerRouterFactory;

di.annotate(pollerRouterFactory,
    new di.Inject(
        'Services.Waterline',
        'poller-service',
        'poller-cache-service',
        'common-api-presenter'
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
function pollerRouterFactory (waterline, pollerService, pollerCache, presenter) {

    /**
     * @apiGroup pollers
     * @api {post} /api/common/pollers/ POST /
     * @apiDescription create a poller
     * @apiName pollers-create
     * @apiGroup pollers
     * */

    router.post('/pollers', presenter.middleware(function (req) {
        return pollerService.createPoller(
            req.body.type,
            _.omit(req.body, 'type')
        );
    }));

    /**
     * @api {get} /api/common/pollers/ GET /
     * @apiDescription get a list of all pollers
     * @apiName pollers-get
     * @apiGroup pollers
     */

    router.get('/pollers', presenter.middleware(function (req) {
       return waterline.pollers.find(req.query);
    }));

    // TODO: Get this from the forthcoming Poller Service Manager.
    var pollers = [
        {
            service: 'eapi',
            config: {
                user:   {default: '', type: 'string' },
                pass:   {default: '', type: 'string' },
                ip:     {default: '', type: 'string' },
                port:   {default: '', type: 'integer'},
                strict: {default: '', type: 'string' }
            }
        },
        {
            service: 'ipmi',
            config: {
                ip:       {default: '', type: 'string'},
                user:     {default: '', type: 'string'},
                password: {default: '', type: 'string'},
                node:     {default: '', type: 'string'}
            }
        },/*
        {
            service: 'sdr-poller',
            config: {
                ip:       {default: '', type: 'string'},
                user:     {default: '', type: 'string'},
                password: {default: '', type: 'string'},
                node:     {default: '', type: 'string'}
            }
        },*/
        {
            service: 'snmp',
            config: {
                ip:              {default: '', type: 'string'},
                communityString: {default: 'public', type: 'string'},
                deviceFamily:    {default: 'apc-pdu', type: 'string'}
            }
        }
    ];

    /**
     * @api {get} /api/common/pollers/library GET /library
     * @apiDescription get list of possible pollers services
     * @apiName pollers-library-get
     * @apiGroup pollers
     */

    router.get('/pollers/library', presenter.middleware(pollers));

    /**
     * @api {get} /api/common/pollers/library/:identifier GET /library/:identifier
     * @apiDescription get a single OBM service
     * @apiName pollers-library-service-get
     * @apiGroup pollers
     */

    router.get('/pollers/library/:identifier', presenter.middleware(function (req) {
        return _.detect(pollers, { service: req.param('identifier') });
    }));

    /**
     * @api {get} /api/common/pollers/:identifier GET /:identifier
     * @apiDescription Get specifics of the specified device.
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
        return waterline.pollers.findByIdentifier(req.param('identifier'));
    }));

    /**
     * @api {delete} /api/common/pollers/:identifier DELETE /:id
     * @apiDescription Delete all pollers of specified device.
     * @apiName poller-delete
     * @apiGroup pollers
     * @apiParam {String} identifier String representation of the ObjectId
     */

    router.delete('/pollers/:identifier', presenter.middleware(function (req) {
        return waterline.pollers.destroyByIdentifier(
            req.param('identifier')
        );
    }, { success: 204 }));

    /**
     * @api {get} /api/common/pollers/:identifier/data GET /:identifier
     * @apiDescription Get specifics of the specified device.
     * @apiName poller-get-data
     * @apiGroup pollers
     * @apiParam {String} identifier (ip address or NodeId) for the data from a poller
     */

    router.get('/pollers/:identifier/data', presenter.middleware(function(req) {
        return pollerCache.getLatestForId(req.param('identifier'));
    }));

    return router;
}
