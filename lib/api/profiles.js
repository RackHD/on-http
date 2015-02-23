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
        'Profiles',
        'common-api-presenter'
    )
);

function profilesRouterFactory (
    profileApiService,
    lookupService,
    profiles,
    presenter
) {
    var router = express.Router();

    router.use(lookupService.ipAddressToMacAddressMiddleware());


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
            .renderPlain(profiles.get(req.param('identifier')));
    });


    /**
     * @api {get} /api/1.1/profiles/library PUT
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
        profiles.put(req.param('identifier'), req.body.toString()).then(function () {
            res.status(200).send();
        }).catch(function (error) {
            res.status(500).json(error);
        });
    });


    /**
     * @api {get} /api/1.1/profiles GET /
     * @apiVersion 1.1.0
     * @apiDescription used internally by the Renasar system -- will NOT get a list of all profiles, look at profiles/library
     * @apiName profiles-get
     * @apiGroup profiles
     */

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
