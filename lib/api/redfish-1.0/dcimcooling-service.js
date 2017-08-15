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
var Logger = injector.get('Logger');
var logger = Logger.initialize('event-service');

var listDCIMCoolingDomain = controller(function (req, res) {
    var options = redfish.makeOptions(req, res);
    options.domain = req.swagger.params.domain.value;

    return waterline.nodes.find({type: 'cooling'}).then(function (nodes) {
        options.nodes = nodes;
        var types = [];
        _.forEach(nodes, function(node) {
            if(node.identifiers[2] === options.domain) {
                types.push(node.identifiers[3]);
            }
        });
        options.types = _.uniq(types);
        return redfish.render('redfish.1.0.0.DCIMCoolingDomain.json',
            '',
            options);
    }).catch(function (error) {
        return redfish.handleError(error, res);
    });
});


var listDCIMCoolingDomainCollection = controller(function (req, res) {
    var options = redfish.makeOptions(req, res);
    return waterline.nodes.find({type: 'cooling'}).then(function (nodes) {
        options.nodes = nodes;
        var domains = [];
        _.forEach(nodes, function (node) {
            domains.push(node.identifiers[2]);
        });
        options.domains = _.uniq(domains);
        return redfish.render('redfish.1.0.0.DCIMCoolingDomainCollection.json',
            '',
            options);
    }).catch(function (error) {
        return redfish.handleError(error, res);
    });
});

var listDCIMCoolingTypeCollection = controller(function (req, res) {
    var options = redfish.makeOptions(req, res);
    options.type = req.swagger.params.type.value;
    options.domain = req.swagger.params.domain.value;

    return waterline.nodes.find({type: 'cooling'}).then(function (nodes) {
        options.nodes = [];

        _.forEach(nodes, function (node) {
            if(node.identifiers[2] === options.domain && node.identifiers[3] === options.type) {
                options.nodes.push(node);
            }
        });
        return redfish.render('redfish.1.0.0.DCIMCoolingTypeCollection.json',
            '',
            options);
    }).catch(function (error) {
        return redfish.handleError(error, res);
    });
});

var listDCIMCoolingDefault = controller(function (req, res) {
    var options = redfish.makeOptions(req, res);
    var identifier = req.swagger.params.identifier.value;
    var nodeId = identifier.split(['-'])[1];
    var schemaNameWithId = identifier.split(['-'])[0];
    return waterline.nodes.getNodeById(nodeId)
        .then(function (node) {
            options.nodeId = node.id;
            options.component = node.name;
            if (_.contains(node.name.toLowerCase(), 'chiller')) {
                return redfish.render('redfish.1.0.0.DCIMCoolingChiller.json',
                    '',
                    options);
            }
            if (_.contains(node.name.toLowerCase(), 'crac')) {
                return redfish.render('redfish.1.0.0.DCIMCoolingCRAC.json',
                    '',
                    options);
            }
            if (_.contains(node.name.toLowerCase(), 'crah')) {
                return redfish.render('redfish.1.0.0.DCIMCoolingCRAH.json',
                    '',
                    options);
            }
            if (_.contains(node.name.toLowerCase(), 'airhandlingunit')) {
                return redfish.render('redfish.1.0.0.DCIMCoolingAirHandlingUnit.json',
                    '',
                    options);
            }
            if (_.contains(node.name.toLowerCase(), 'coolingtower')) {
                return redfish.render('redfish.1.0.0.DCIMCoolingCoolingTower.json',
                    '',
                    options);
            }
        }).catch(function (error) {
            return redfish.handleError(error, res);
        });
});

module.exports = {
    listDCIMCoolingDomain: listDCIMCoolingDomain,
    listDCIMCoolingDomainCollection: listDCIMCoolingDomainCollection,
    listDCIMCoolingTypeCollection: listDCIMCoolingTypeCollection,
    listDCIMCoolingDefault: listDCIMCoolingDefault
};
