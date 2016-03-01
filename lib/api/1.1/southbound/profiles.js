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
        'Logger'
    )
);

function profilesRouterFactory (
    profileApiService,
    presenter,
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
        if (req.query.mac && req.query.ip) {
            profileApiService.setLookup(req.query)
            .catch(function(err) {
                logger.error('Error Setting Lookup', {
                    mac: req.params.mac,
                    ip: req.params.ip,
                    error: err
                });
                res.status(500).json(err);
            });
            req.query.macs = req.query.mac;
        }

        if (req.query.macs) {
            var macAddresses = profileApiService.getMacs(req.query.macs);
            return profileApiService.getNode(macAddresses)
            .then(function (node) {
                if (node.newRecord) {
                    presenter(req, res).renderProfile('redirect.ipxe');
                } else {
                    return profileApiService.renderProfileFromTask(node)
                    .then(function (render) {
                        presenter(req, res).renderProfile(render.profile, render.options);
                    });
                }
            })
            .catch(function (err) {
                presenter(req, res).renderError(err);
            });
        } else {
            presenter(req, res).renderProfile('redirect.ipxe');
        }
    });

    return router;
}
