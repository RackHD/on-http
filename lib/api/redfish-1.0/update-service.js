// Copyright © 2017 Dell Inc. or its subsidiaries.  All Rights Reserved.

'use strict';

var injector = require('../../../index.js').injector;
var redfish = injector.get('Http.Api.Services.Redfish');
var Promise = injector.get('Promise'); // jshint ignore:line
var _ = injector.get('_');  // jshint ignore:line
var controller = injector.get('Http.Services.Swagger').controller;
var Errors = injector.get('Errors');
var workflow = injector.get('Http.Services.Api.Workflows');
var waterline = injector.get('Services.Waterline');

var updateFirmware = controller({success: 201}, function (req, res) {
    var payload = req.swagger.params.payload.value;
    var targetNodeIds = payload.Targets;
    var errorList = [];
    var transactionError = false;
    var options = redfish.makeOptions(req, res, payload);

    return Promise.try(function () {
        // Run update firmware graph for each specified node id
        // If there are any errors, the entire request fails
        return Promise.map(
            targetNodeIds,
            function (targetNodeId) {
                return waterline.nodes.getNodeById(targetNodeId)
                    .then(function (targetNode) {
                        if (!targetNode) {
                            transactionError = true;
                            throw new Errors.NotFoundError(
                                'Node not Found ' + targetNodeId);
                        }
                    })
                    .then(function () {
                        return waterline.obms.findAllByNode(targetNodeId, true);
                    })
                    .then(function (obmSettings) {
                        if (!obmSettings) {
                            transactionError = true;
                            throw new Errors.NotFoundError(
                                'OBM settings not defined for node: ' + targetNodeId);
                        }

                        // Find IPMI settings for the node
                        var obm = _.find(obmSettings, {'service': 'ipmi-obm-service'});
                        if (!obm) {
                            transactionError = true;
                            throw new Errors.NotFoundError(
                                'IPMI settings not defined for node: ' + targetNodeId);
                        }

                        if (!transactionError) {
                            return workflow.createAndRunGraph(
                                {
                                    name: 'Graph.Dell.Racadm.Update.Firmware',
                                    options: {
                                        defaults: {
                                            serverUsername: obm.config.user,
                                            serverPassword: obm.config.password,
                                            serverFilePath: payload.ImageURI
                                        }
                                    }
                                },
                                targetNodeId
                            );
                        }
                    })
                    .then(function (graph) {
                        if (graph) {
                            var output = {
                                "@odata.id": options.basepath +
                                '/TaskService/Tasks/' +
                                graph.instanceId
                            };
                            res.status(201).json(output);
                        }
                    })
                    .catch(function (error) {
                        errorList.push(error);
                    });
            }
        );
    }).then(function () {
        if (errorList.length > 0) {
            throw new Error('One or more errors occured: ' + errorList);
        }
    }).catch(function (error) {
        var status = 400;
        return redfish.handleError(error, res, undefined, status);
    });
});

module.exports = {
    updateFirmware: updateFirmware
};
