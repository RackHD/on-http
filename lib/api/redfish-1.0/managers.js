// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var redfish = injector.get('Http.Api.Services.Redfish');
var waterline = injector.get('Services.Waterline');
var Promise = injector.get('Promise');    // jshint ignore:line
var _ = injector.get('_');                // jshint ignore:line
var nodeApi = injector.get('Http.Services.Api.Nodes');
var controller = injector.get('Http.Services.Swagger').controller;
var Errors = injector.get('Errors');
var assert = injector.get('Assert');

var listManagers = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);
    return waterline.nodes.find({type: 'compute'})
    .then(function(nodes) {
        options.managers = _.reduce(nodes, function(arr, val) {
            _.forEach(val.obmSettings, function(item, idx) {
                arr.push({ id: val.id + '.' + idx, manager: item });
            });
            return arr;
        }, []);
        return redfish.render('redfish.1.0.0.managercollection.json',
                            'ManagerCollection.json#/definitions/ManagerCollection',
                            options);
    }).catch(function(error) {
        return redfish.handleError(error, res);
    });
});

var getManager = controller(function(req, res) {
    var identifier = req.swagger.params.identifier.value;
    var options = redfish.makeOptions(req, res, identifier);
    var parts = identifier.split('.');
    var managerType = function(type) {
        switch(type) {
        case 'ipmi-obm-service':
            return 'BMC';
        default:
            return 'ManagementController';
        }
    };

    return Promise.try(function() {
        assert.ok(_.isArray(parts), 'invalid identifier specified: ' + identifier);
        assert.string(parts[0], 'invalid identifier specified: ' + identifier);
        return waterline.nodes.needByIdentifier(parts[0]);
    })
    .then(function(node) {
        assert.ok(_.isArray(node.obmSettings), 'invalid obmSettings');
        assert.ok(node.obmSettings.length === parseInt(parts[1]) + 1, 'invalid obmSetting');
        options.systems = [ node.id ];
        options.chassis = _.reduce(node.relations, function(arr,val) {
            if(val.relationType === 'enclosedBy')  {
                arr.push(val.targets[0]);
            }
            return arr;
        }, []);
        options.managerType = managerType(node.obmSettings[parts[1]].service);
        return nodeApi.getNodeCatalogSourceById(node.id, 'ipmi-mc-info');
    })
    .then(function(mcInfo) {
        options.mcInfo = mcInfo.data;
        return redfish.render('redfish.1.0.0.manager.1.0.0.json',
                            'Manager.1.0.0.json#/definitions/Manager',
                            options);
    })
    .catch(function(error) {
        if(error.name === 'AssertionError') {
            error = new Errors.NotFoundError('invalid resource');
        }
        return redfish.handleError(error, res);
    });
});

var listManagerEthernetInterfaces = controller(function(req, res) {
    var identifier = req.swagger.params.identifier.value;
    var options = redfish.makeOptions(req, res, identifier);
    var parts = identifier.split('.');

    return Promise.try(function() {
        assert.ok(_.isArray(parts), 'invalid identifier specified: ' + identifier);
        assert.string(parts[0], 'invalid identifier specified: ' + identifier);
        return waterline.nodes.needByIdentifier(parts[0]);
    })
    .then(function(node) {
        assert.ok(_.isArray(node.obmSettings), 'invalid obmSettings');
        assert.ok(node.obmSettings.length === parseInt(parts[1]) + 1, 'invalid obmSetting');
        options.net = [ '0' ];  // there is only one host per obmsetting
        return redfish.render('redfish.1.0.0.ethernetinterfacecollection.json',
                            'EthernetInterfaceCollection.json#/definitions/EthernetInterfaceCollection',
                            options);
    })
    .catch(function(error) {
        if(error.name === 'AssertionError') {
            error = new Errors.NotFoundError('invalid resource');
        }
        return redfish.handleError(error, res);
    });
});

var getManagerEthernetInterface = controller(function(req, res) {
    var identifier = req.swagger.params.identifier.value;
    var index = req.swagger.params.index.value;
    var options = redfish.makeOptions(req, res, identifier);
    var parts = identifier.split('.');

    return Promise.try(function() {
        assert.ok(_.isArray(parts), 'invalid identifier specified: ' + identifier);
        assert.string(parts[0], 'invalid identifier specified: ' + identifier);
        return waterline.nodes.needByIdentifier(parts[0]);
    })
    .then(function(node) {
        assert.ok(_.isArray(node.obmSettings), 'invalid obmSettings');
        assert.ok(node.obmSettings.length === parseInt(parts[1]) + 1, 'invalid obmSetting');
        return nodeApi.getNodeCatalogSourceById(node.id, 'bmc');
    })
    .then(function(data) {
        options.index = index;
        options.hostMAC = data.data['MAC Address'];
        if(data.data['802_1q VLAN ID'] !== 'Disabled') {
            options.vlan = data.data['802_1q VLAN ID'];
        }
        options.ipv4 = [ 
            {
                ipaddr: data.data['IP Address'],
                ipsubnet: data.data['Subnet Mask'],
                ipgateway: data.data['Default Gateway IP'],
                ipsrc: _.includes(data.data['IP Address Source'], 'DHCP') ? 'DHCP' : 'Static'
            }
        ];
        return redfish.render('redfish.1.0.0.ethernetinterface.1.0.0.json',
                            'EthernetInterface.1.0.0.json#/definitions/EthernetInterface',
                            options);
    })
    .catch(function(error) {
        if(error.name === 'AssertionError') {
            error = new Errors.NotFoundError('invalid resource');
        }
        return redfish.handleError(error, res);
    });
});

module.exports = {
    listManagers: listManagers,
    getManager: getManager,
    listManagerEthernetInterfaces: listManagerEthernetInterfaces,
    getManagerEthernetInterface: getManagerEthernetInterface
};
