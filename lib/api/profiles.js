// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node: true */
'use strict';

var di = require('di'),
    lodash = require('lodash'),
    express = require('express'),
    parser = require('body-parser'),
    router = express.Router();

module.exports = profilesRouterFactory;

di.annotate(profilesRouterFactory,
    new di.Inject(
        'Protocol.TaskGraphRunner',
        'Protocol.Task',
        'Services.Waterline',
        'Services.Lookup',
        'Services.Profile',
        'common-api-presenter',
        'Logger'
    )
);

function profilesRouterFactory (
    taskGraphService,
    taskProtocol,
    waterline,
    lookupService,
    profileService,
    presenter,
    Logger
) {
    var logger = Logger.initialize(profilesRouterFactory);

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

    router.get('/profiles/library/:identifier', function (req, res) {
        presenter(req, res)
            .renderPlain(profileService.get(req.param('identifier')));
    });

    router.put('/profiles/library/:identifier', parser.raw(), function (req, res) {
        profileService.put(req.param('identifier'), req.body).then(function () {
            res.status(200).send();
        }).catch(function (error) {
            res.status(500).json(error);
        });
    });

    router.get('/profiles', function (req, res) {
        if (req.param('macs')) {
            var macAddresses = lodash.flatten([req.param('macs')]);

            waterline.nodes.findByIdentifier(macAddresses).then(function (node) {
                if (node) {
                    return node;
                } else {
                    return waterline.nodes.create({
                        name: macAddresses.join(','),
                        identifiers: macAddresses
                    })
                    .then(function (node) {
                        // Setting newRecord to true allows us to
                        // render the redirect again to avoid refresh
                        // of the node document and race conditions with
                        // the state machine changing states.
                        node.newRecord = true;

                        var options = {
                            defaults: {
                                graphOptions: {
                                    target: node.id
                                },
                                nodeId: node.id
                            }
                        };

                        return taskGraphService.runTaskGraph(
                            'Graph.SKU.Discovery', options, undefined)
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
                    return taskGraphService.getActiveTaskGraph({ target: node.id })
                    .then(function (taskgraphInstance) {
                        if (taskgraphInstance) {
                            return taskProtocol.requestProfile(node.id)
                                .then(function(profile) {
                                    return [profile, taskProtocol.requestProperties(node.id)];
                                })
                                .spread(function (profile, properties) {
                                    return {
                                        profile: profile || 'redirect.ipxe',
                                        options: convertProperties(properties)
                                    };
                                })
                                .catch(function (e) {
                                    logger.error("Unable to retrieve workflow properties.", {
                                        error: e,
                                        id: node.id,
                                        taskgraphInstance: taskgraphInstance
                                    });
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
                                    error: new Error('Unable to locate active workflow.')
                                }
                            };
                        }
                    }).then(function (render) {
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
