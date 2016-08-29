// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    express = require('express');

module.exports = profilesRouterFactory;

di.annotate(profilesRouterFactory, new di.Provide('Http.Api.Internal.Profiles'));
di.annotate(profilesRouterFactory,
    new di.Inject(
        'Http.Services.Api.Profiles',
        'common-api-presenter',
	'Services.Lookup',
        'Logger'
    )
);

function profilesRouterFactory (
    profileApiService,
    presenter,
    lookupService,
    Logger
) {
    var router = express.Router();
    var logger = Logger.initialize(profilesRouterFactory);

    /**
     * @api {get} /api/1.1/profiles GET /
     * @apiVersion 1.1.0
     * @apiParam {query} macs List of valid MAC addresses to lookup
     * @apiParam {query} mac When macs parameter is not passed,
     *                       passed with IP adds MAC address to lookup
     * @apiParam {query} ip When macs parameters is not passed,
     *                      passed with MAC adds IP address to lookup
     * @apiDescription used internally by the system -- will NOT get a list of all profiles,
     *                 look at api/current/profiles/library
     * @apiName profiles-get
     * @apiGroup profiles
     */

    router.get('/profiles', function (req, res) {
        return profileApiService.setLookup(req, res)
        .then(function() {
            var macs = req.query.mac || req.query.macs;
            if (macs) {
                var macAddresses = profileApiService.getMacs(macs);
                var options = {
                    type: 'compute',
                };

                return profileApiService.getNode(macAddresses, options)
                .then(function (node) {
                    return profileApiService.getProfileFromTaskOrNode(node, 'compute')
                    .then(function (render) {
                        presenter(req, res).renderProfile(render.profile, render.options, 200, render.context);
                    });
                });
            } else {
                presenter(req, res).renderProfile('redirect.ipxe', { ignoreLookup: true });
            }
        })
        .catch(function (err) {
            presenter(req, res).renderError(err);
        });
    });

    /**
     * @api {get} /api/1.1/profiles/switch/:vendor GET /
     * @apiVersion 1.1.0
     * @apiDescription used internally for active discovery of network switches
     * @apiName profiles-switch-get
     * @apiGroup profiles
     */

    router.get('/profiles/switch/:vendor',
        lookupService.ipAddressToMacAddressMiddleware(), function (req, res) {
        var macAddresses = profileApiService.getMacs(req.macaddress);
        var options = {
            type: 'switch',
            switchVendor: req.params.vendor
        };

        profileApiService.getNode(macAddresses, options)
        .then(function(node) {
            return profileApiService.getProfileFromTaskOrNode(node, 'switch');
        })
        .then(function(render) {
            presenter(req, res).renderProfile(
                render.profile,
                render.options,
                200,
                render.context
            );
        })
        .catch(function (err) {
            presenter(req, res).renderError(err);
        });
    });

    /**
     * @api {get} /api/1.1/profiles/switch/error GET /
     * @apiVersion 1.1.0
     * @apiDescription most switches don't print errors, so this is a debug route
     *                  for capturing switch-local errors during discovery
     * @apiName profiles-switch-error
     * @apiGroup profiles
     */

    router.post('/profiles/switch/error/', function(req, res) {
        logger.error('SWITCH ERROR DEBUG ', req.body);
        res.status(200).send('');
    });

    return router;
}
