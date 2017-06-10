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
var os = injector.get('os');
var fs = Promise.promisifyAll(injector.get('fs'));
var dns = Promise.promisifyAll(require('dns'));
var ip = require('ip');
var configuration = injector.get('Services.Configuration');
var upnpService = injector.get('Http.Services.uPnP');

var reservedId = 'RackHD';

var dnsGetFQDN = function() {
    if(dns.lookupServiceAsync) {
        return dns.lookupServiceAsync(ip.address(), 0)
        .then(function(fqdns) {
            return fqdns[0];
        })
        .catch(function() {
            return os.hostname();
        });
    }
    return os.hostname();
};

var listManagers = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);
    return Promise.map(waterline.nodes.find({type: 'compute'}), function(node) {
        return waterline.nodes.getNodeById(node.id);
    })
    .then(function(nodes) {
        options.managers = _.reduce(nodes, function(arr, val) {
            _.forEach(val.obms, function(item, idx) {
                arr.push({ id: val.id + '.' + idx, manager: item });
            });
            return arr;
        }, []);
        options.managers.push({id: reservedId});
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

    return Promise.try(function() {
        if(identifier === reservedId) {
            return waterline.nodes.find({type: 'compute'});
        }
        assert.ok(_.isArray(parts), 'invalid identifier specified: ' + identifier);
        assert.ok(parts.length === 2, 'invalid identifier format: ' + identifier);
        assert.string(parts[0], 'invalid identifier specified: ' + identifier);
        return waterline.nodes.find({id: parts[0]});
    })
    .then(function(nodes) {
        if(_.isEmpty(nodes)) {
            return [];
        }
        return Promise.map(nodes, function(node) {
            return waterline.nodes.getNodeById(node.id);
        });
    })
    .then(function(nodes) {
        if(parts[1]) {
            _.forEach(nodes, function(node) {
                assert.ok(_.isArray(node.obms), 'invalid resource');
                assert.ok(node.obms.length > parts[1], 'invalid resource');
            });
        }

        options.systems = _.map(nodes, 'id');
        options.chassis = _.reduce(nodes, function(arr,val) {
            _.forEach(val.relations, function(val) {
                if(val.relationType === 'enclosedBy')  {
                    arr.push(val.targets[0]);
                }
            });
            return arr;
        }, []);

        options.managerType = identifier === reservedId ? 'ManagementController' : 'BMC';
        if(identifier !== reservedId) {
            return nodeApi.getNodeCatalogSourceById(nodes[0].id, 'ipmi-mc-info')
            .then(function(mcInfo) {
                options.mcInfo = mcInfo.data;
            });
        }
    })
    .then(function() {
        if(identifier === reservedId) {
            var locations = _.filter(configuration.get('httpEndpoints', []), 
                            _.matches({routers:'northbound-api-router'}));
            var httpLocation = _.find(locations, {httpsEnabled: false});
            var httpsLocation = _.find(locations, {httpsEnabled: true});

            var services = [];
            if(httpLocation) {
                services.push({ name: 'HTTP', port: httpLocation.port, enabled: true });
            }
            if(httpsLocation) {
                services.push({ name: 'HTTPS', port: httpsLocation.port, enabled: true });
            }
            var enabled = _.find(upnpService.registry, {urn: 'urn:dmtf-org:service:redfish-rest:1.0'}).alive;
            services.push({ name: 'SSDP', port: 1900, enabled: enabled });
            return Promise.props({
                hostname: os.hostname(),
                fqdn: dnsGetFQDN(),
                services: services
            });
        }
    })
    .then(function(networkProtocol) {
        if(networkProtocol) {
            options.networkProtocol = networkProtocol;
        }
        return redfish.render('redfish.1.0.0.manager.1.0.0.json',
                            'Manager.v1_3_0.json#/definitions/Manager',
                            options);
    })
    .catch(function(error) {
        if(error.name === 'AssertionError') {
            error = new Errors.NotFoundError('invalid resource: ' + error.message);
        }
        return redfish.handleError(error, res);
    });
});

var patchManager = controller({success: 204}, function(req, res) {
    var identifier = req.swagger.params.identifier.value;
    var options = redfish.makeOptions(req, res, identifier);
    var payload = req.swagger.params.payload.value;
    var parts = identifier.split('.');

    return Promise.try(function() {
        if(identifier === reservedId) {
            return waterline.nodes.find({type: 'compute'});
        }

        if(identifier !== reservedId) {
            var err = new Errors.BaseError('method not allowed');
            err.status = 405;
            throw err;
        }

        return waterline.nodes.find({id: parts[0]});
    })
    .then(function(nodes) {
        if(_.isEmpty(nodes)) {
            throw new Errors.NotFoundError('invalid resource');
        }

        if(!_.isUndefined(_.get(payload, 'NetworkProtocol.SSDP.ProtocolEnabled'))) {
            var server = _.find(upnpService.ssdpList, {urn: 'urn:dmtf-org:service:redfish-rest:1.0'});
            var registry = _.find(upnpService.registry, {urn: 'urn:dmtf-org:service:redfish-rest:1.0'});
            if(server && registry) {
                registry.alive = payload.NetworkProtocol.SSDP.ProtocolEnabled;
                registry.alive ? server.server.start() : server.server.stop();
            }
        }
    })
    .catch(function(error) {
        if(error.name === 'AssertionError') {
            error = new Errors.NotFoundError('invalid resource: ' + error.message);
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
        assert.ok(parts.length === 2, 'invalid identifier format: ' + identifier);
        assert.string(parts[0], 'invalid identifier specified: ' + identifier);
        return waterline.nodes.needByIdentifier(parts[0]);
    })
    .then(function(node) {
        return waterline.nodes.getNodeById(node.id);
    })
    .then(function(node) {
        assert.ok(_.isArray(node.obms), 'invalid obmSettings');
        assert.ok(node.obms.length === parseInt(parts[1]) + 1, 'invalid obmSetting');
        options.name = "Manager Ethernet Interface Collection";
        options.net = [ '0' ];  // there is only one host per obmsetting
        options.baseprofile = 'Managers';
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
        assert.ok(parts.length === 2, 'invalid identifier format: ' + identifier);
        assert.string(parts[0], 'invalid identifier specified: ' + identifier);
        return waterline.nodes.needByIdentifier(parts[0]);
    })
    .then(function(node) {
        return waterline.nodes.getNodeById(node.id);
    })
    .then(function(node) {
        assert.ok(_.isArray(node.obms), 'invalid obmSettings');
        assert.ok(node.obms.length === parseInt(parts[1]) + 1, 'invalid obmSetting');
        return nodeApi.getNodeCatalogSourceById(node.id, 'bmc');
    })
    .then(function(data) {
        options.name = "Manager Ethernet Interface";
        options.baseprofile = 'Managers';
        options.index = index;
        options.permanentmacaddress = data.data['MAC Address'];
        options.macaddress = data.data['MAC Address'];
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
                            'EthernetInterface.v1_2_0.json#/definitions/EthernetInterface',
                            options);
    })
    .catch(function(error) {
        if(error.name === 'AssertionError') {
            error = new Errors.NotFoundError('invalid resource');
        }
        return redfish.handleError(error, res);
    });
});

var listLocalEthernetInterfaces = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);
    options.net = _.reduce(os.networkInterfaces(), function(arr, val, key) {
        _.forEach(val, function(item) {
            if(!item.internal && item.family === 'IPv4') {
                arr.push(key);
            }
        });
        return arr;
    }, []);
    options.name = "Manager Ethernet Interface Collection";
    options.baseprofile = 'Managers';
    options.identifier = reservedId;
    return redfish.render('redfish.1.0.0.ethernetinterfacecollection.json',
                          'EthernetInterfaceCollection.json#/definitions/EthernetInterfaceCollection',
                          options)
    .catch(function(error) {
        return redfish.handleError(error, res);
    });
});

var getLocalEthernetInterface = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);
    var index = req.swagger.params.index.value;

    return Promise.try(function() {
        var net = _.get(os.networkInterfaces(), index);
        if(!net) {
            throw new Errors.NotFoundError('invalid resource');
        }

        options.name = "Manager Ethernet Interface";
        options.baseprofile = 'Managers';
        options.index = index;
        options.ipv4 = _.reduce(net, function(arr, val) {
            if(!val.internal && val.family === 'IPv4') {
                var obj = {
                    ipaddr: val.address
                };
                if(val.netmask) {  // not available in node 0.10
                    obj.ipsubnet = val.netmask;
                }
                if(val.mac) { // not available in node 0.10
                    options.permanentmacaddress = val.mac;
                    options.macaddress = val.mac;
                }
                arr.push(obj);
            }
            return arr;
        }, []);
        return redfish.render('redfish.1.0.0.ethernetinterface.1.0.0.json',
                              'EthernetInterface.v1_2_0.json#/definitions/EthernetInterface',
                              options)
    })
    .catch(function(error) {
        return redfish.handleError(error, res);
    });
});

module.exports = {
    listManagers: listManagers,
    getManager: getManager,
    patchManager: patchManager,
    listManagerEthernetInterfaces: listManagerEthernetInterfaces,
    getManagerEthernetInterface: getManagerEthernetInterface,
    listLocalEthernetInterfaces: listLocalEthernetInterfaces,
    getLocalEthernetInterface: getLocalEthernetInterface
};
