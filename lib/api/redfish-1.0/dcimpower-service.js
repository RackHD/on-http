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
var nodeApi = injector.get('Http.Services.Api.Nodes');


var listDCIMPower = controller(function (req, res) {
    var options = redfish.makeOptions(req, res);
    return waterline.nodes.find({type: 'power'}).then(function (nodes) {
        options.nodes = nodes;
        return redfish.render('redfish.1.0.0.DCIMPowerCollection.json',
            '',
            options);
    }).catch(function (error) {
        return redfish.handleError(error, res);
    });
});

var listDCIMPowerDefault = controller(function (req, res) {
    var options = redfish.makeOptions(req, res);
    var identifier = req.swagger.params.identifier.value;
    var nodeId = identifier.split(['-'])[1];
    var schemaNameWithId = identifier.split(['-'])[0];
    return waterline.nodes.getNodeById(nodeId)
        .then(function (node) {
            options.nodeId = node.id;
            options.component = node.name;
            if (_.contains(node.name.toLowerCase(), 'generator')) {
                return redfish.render('redfish.1.0.0.DCIMPowerGenerator.json',
                    '',
                    options);
            }
            if (_.contains(node.name.toLowerCase(), 'rackpdu')) {
                return redfish.render('redfish.1.0.0.DCIMPowerRackPDU.json',
                    '',
                    options);
            }
            if (_.contains(node.name.toLowerCase(), 'pdu')) {
                return redfish.render('redfish.1.0.0.DCIMPowerPDU.json',
                    '',
                    options);
            }
            if (_.contains(node.name.toLowerCase(), 'rectifier')) {
                return redfish.render('redfish.1.0.0.DCIMPowerRectifier.json',
                    '',
                    options);
            }
            if (_.contains(node.name.toLowerCase(), 'switchgear')) {
                return redfish.render('redfish.1.0.0.DCIMPowerSwitchgear.json',
                    '',
                    options);
            }
            if (_.contains(node.name.toLowerCase(), 'transformer')) {
                return redfish.render('redfish.1.0.0.DCIMPowerTransformer.json',
                    '',
                    options);
            }
            if (_.contains(node.name.toLowerCase(), 'ups')) {
                return redfish.render('redfish.1.0.0.DCIMPowerUPS.json',
                    '',
                    options);
            }
            if (_.contains(node.name.toLowerCase(), 'vfd')) {
                return redfish.render('redfish.1.0.0.DCIMPowerVFD.json',
                    '',
                    options);
            }
            if (_.contains(node.name.toLowerCase(), 'transferswitch')) {
                return redfish.render('redfish.1.0.0.DCIMPowerTransferSwitch.json',
                    '',
                    options);
            }
        }).catch(function (error) {
            return redfish.handleError(error, res);
        });
});

var listDCIMPowerDefaultComponent = controller(function (req, res) {
    var options = redfish.makeOptions(req, res);
    var identifier = req.swagger.params.identifier.value;
    var nodeId = identifier.split(['-'])[1];
    var schemaNameWithId = identifier.split(['-'])[0];
    return waterline.nodes.getNodeById(nodeId)
        .then(function (node) {
            options.nodeId = node.id;
            options.component = node.name;
            var splitNameNumber = options.component.split(/[0-9]+/);
            options.componentName = splitNameNumber[0];
            options.componentId = options.component.match(/\d/g)[0];
            return redfish.render('redfish.1.0.0.DCIMPowerComponentCollection.json',
                '',
                options);
        }).catch(function (error) {
            return redfish.handleError(error, res);
        });
});


module.exports = {
    listDCIMPower: listDCIMPower,
    listDCIMPowerDefault: listDCIMPowerDefault,
    listDCIMPowerDefaultComponent: listDCIMPowerDefaultComponent
};
