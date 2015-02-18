// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node: true */
'use strict';

var di = require('di'),
    express = require('express'),
    parser = require('body-parser');

module.exports = profilesRouterFactory;

di.annotate(profilesRouterFactory, new di.Provide('Http.Api.Profiles'));
di.annotate(profilesRouterFactory,
    new di.Inject(
        'Http.Services.Api.Profiles',
        'Services.Lookup',
        'Services.Profile',
        'common-api-presenter'
    )
);

function profilesRouterFactory (
    profileApiService,
    lookupService,
    profileService,
    presenter
) {
    var router = express.Router();

    router.use(lookupService.ipAddressToMacAddressMiddleware());

    router.get('/profiles/library', presenter.middleware(function () {
        return profileService.getAll();
    }));

    router.get('/profiles/library/:identifier', function (req, res) {
        presenter(req, res)
            .renderPlain(profileService.get(req.param('identifier')));
    });

    router.put('/profiles/library/:identifier', parser.raw(), function (req, res) {
        profileService.put(req.param('identifier'), req.body.toString()).then(function () {
            res.status(200).send();
        }).catch(function (error) {
            res.status(500).json(error);
        });
    });

    router.get('/profiles', function (req, res) {
        if (req.param('macs')) {
            var macAddresses = profileApiService.getMacs(req.param('macs'));

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
