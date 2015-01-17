// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node: true */
'use strict';

var di = require('di'),
    lodash = require('lodash'),
    express = require('express'),
    parser = require('body-parser'),
    router = express.Router();

router.use(parser.json());

module.exports = profilesRouterFactory;

di.annotate(profilesRouterFactory,
    new di.Inject(
        'Protocol.TaskGraphRunner',
        'Services.Waterline',
        'Services.Lookup',
        'Services.Profile',
        'common-api-presenter',
        'Logger',
        'Tracer'
    )
);

function profilesRouterFactory (
    taskGraphService,
    waterline,
    lookupService,
    profileService,
    presenter
) {
    // Helper to convert property kargs into an ipxe friendly string.
    function convertProperties (properties) {
        properties = properties || {};

        if (properties.hasOwnProperty('kargs')) {
            // This a promotion of the kargs property
            // for DOS disks (or linux) for saving
            // the trouble of having to write a
            // bunch of code in the EJS template.
            properties.kargs = lodash.map(
                properties.kargs, function (value, key) {
                return key + '=' + value;
            }).join(' ');
        } else {
            // Ensure kargs is set for rendering.
            properties.kargs = null;
        }

        return properties;
    }

    router.use(lookupService.ipAddressToMacAddressMiddleware());

    router.get('/profiles/library', presenter.middleware(function () {
        return profileService.getAll();
    }));

    router.get('/profiles', function (req, res) {
        if (req.param('macs')) {
            var macAddresses = lodash.flatten([req.param('macs')]);

            waterline.nodes.findByIdentifier(macAddresses).then(function (node) {
                if (node) {
                    return node;
                } else {
                    // TODO: remove profile since it should really only be on workflows now.
                    var profile = req.param('profile') || 'diskboot.ipxe';
                    return waterline.nodes.create({
                        name: macAddresses.join(','),
                        identifiers: macAddresses,
                        profile: profile
                    })
                    .then(function (node) {
                        // Setting newRecord to true allows us to
                        // render the redirect again to avoid refresh
                        // of the node document and race conditions with
                        // the state machine changing states.
                        node.newRecord = true;
                        var definition = { node: node.id }; // TODO(heckj): update with a real discovery definition

                        return taskGraphService.defineTaskGraph(definition)
                            .then(function(discoveryGraph) {
                                return taskGraphService.runTaskGraph(discoveryGraph.name);
                            })
                            .then(function() {
                                return node;
                            });
                    });
                }
            })
            .then(function (node) {
                if (node.newRecord) {
                    presenter(req, res).renderProfile('redirect.ipxe');
                } else {
                    return taskGraphService.getActiveTaskGraphs({ node: node.id })// TODO(heckj): verify this is a valid filter
                        .then(function (taskgraphInstance) {
                        if (taskgraphInstance) {
                            return workflowService.requestProperties(taskgraphInstance)// TODO(heckj): verify this is a valid filter
                                .then(function (data) {
                                    return {
                                        profile: node.profile || 'redirect.ipxe',
                                        options: convertProperties(data)
                                    };
                                })
                                .fail(function () {
                                    return {
                                        profile: 'error.ipxe',
                                        options: {
                                            error: 'Unable to retrieve workflow properties.'
                                        }
                                    };
                                });
                        } else {
                            return {
                                profile: 'error.ipxe',
                                options: {
                                    error: 'Unable to locate active workflow.'
                                }
                            };
                        }
                    }).then(function (render) {
                        presenter(req, res).renderProfile(render.profile, render.options);
                    });
                }
            })
            .fail(function (err) {
                presenter(req, res).renderError(err);
            });
        } else {
            presenter(req, res).renderProfile('redirect.ipxe');
        }
    });

    return router;
}
