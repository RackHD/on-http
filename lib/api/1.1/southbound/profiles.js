// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    express = require('express');

module.exports = profilesRouterFactory;

di.annotate(profilesRouterFactory, new di.Provide('Http.Api.Internal.Profiles'));
di.annotate(profilesRouterFactory,
    new di.Inject(
        'Http.Services.Api.Profiles',
        'common-api-presenter'
    )
);

function profilesRouterFactory (
    profileApiService,
    presenter
) {
    var router = express.Router();

    /**
     * @api {get} /api/1.1/profiles GET /
     * @apiVersion 1.1.0
     * @apiDescription used internally by the system -- will NOT get a list of all profiles,
     *                 look at api/current/profiles/library
     * @apiName profiles-get
     * @apiGroup profiles
     */

    router.get('/profiles', function (req, res) {
        if (req.query.mac && req.query.ip) {
            profileApiService.setNode(req.query);
            req.query.macs = req.query.mac
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
