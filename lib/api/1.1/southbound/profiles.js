// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    express = require('express'),
    parser = require('body-parser');

module.exports = profilesRouterFactory;

di.annotate(profilesRouterFactory, new di.Provide('Http.Api.Internal.Profiles'));
di.annotate(profilesRouterFactory,
    new di.Inject(
        'Http.Services.Api.Profiles',
        'common-api-presenter',
        'Errors'
    )
);

function profilesRouterFactory (
    profileApiService,
    presenter,
    Errors
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
            .catch(Errors.MaxGraphsRunningError, function(error) {
                // If we've already sent down retry.ipxe, just fail subsequent chain load requests.
                // Do this because if we chainload too many times iPXE will crash.
                if (error.retryLater) {
                    presenter(req, res).renderTooBusy();
                } else {
                    var sleeptimer = parseInt(Math.random() * (120 - 60) + 60);
                    presenter(req, res).renderProfile('retry.ipxe', { sleeptimer: sleeptimer });
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
