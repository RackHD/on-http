// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    express = require('express'),
    parser = require('body-parser');

module.exports = profilesRouterFactory;

di.annotate(profilesRouterFactory, new di.Provide('Http.Api.Profiles'));
di.annotate(profilesRouterFactory,
    new di.Inject(
        'Http.Services.Api.Profiles',
        'Profiles',
        'common-api-presenter',
        'Errors'
    )
);

function profilesRouterFactory (
    profileApiService,
    profiles,
    presenter,
    Errors
) {
    var router = express.Router();

    /**
     * @api {get} /api/1.1/profiles/library GET /library
     * @apiVersion 1.1.0
     * @apiDescription get list of possible profiles
     * @apiName profiles-library-get
     * @apiGroup profiles
     * @apiSuccess {json} profiles list of the available library.
     */

    router.get('/profiles/library', presenter.middleware(function () {
        return profiles.getAll();
    }));


    /**
     * @api {get} /api/1.1/profiles/library/:identifier GET /library/:identifier
     * @apiVersion 1.1.0
     * @apiDescription get a single profile
     * @apiName profile-library-service-get
     * @apiGroup profiles
     * @apiParam {String} identifier String representation of the ObjectId
     * @apiParamExample {String }Identifier-Example:
     *      "diskboot.ipxe"
     * @apiError NotFound There is no profile in the library with <code>identifier</code>
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *     }
     */

    router.get('/profiles/library/:identifier', function (req, res) {
        presenter(req, res)
            .renderPlain(profiles.get(req.params.identifier));
    });


    /**
     * @api {put} /api/1.1/profiles/library PUT
     * @apiVersion 1.1.0
     * @apiDescription put a single profile
     * @apiName profile-library-service-put
     * @apiGroup profiles
     * @apiError Error problem was encountered, profile was not written.
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 500 Error
     *     {
     *       "error": "upload failed."
     *     }
     */

    router.put('/profiles/library/:identifier', parser.raw(), function (req, res) {
        profiles.put(req.params.identifier, req.body.toString()).then(function () {
            res.status(200).send();
        }).catch(function (error) {
            res.status(500).json(error);
        });
    });


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
