// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var redfish = injector.get('Http.Api.Services.Redfish');
var _ = injector.get('_'); // jshint ignore:line
var waterline = injector.get('Services.Waterline');
var Promise = injector.get('Promise'); // jshint ignore:line
var Errors = injector.get('Errors');
var taskProtocol = injector.get('Protocol.Task');
var controller = injector.get('Http.Services.Swagger').controller;

var dataFactory = function(identifier, dataName) {
    switch(dataName)  {
        case 'ohai':
        case 'dmi':
            return waterline.nodes.needByIdentifier(identifier)
            .then(function(node) {
                return waterline.catalogs.findLatestCatalogOfSource(node.id, dataName);
            })
            .then(function (catalogs) {
                if (_.isEmpty(catalogs)) {
                    throw new Errors.NotFoundError(
                        'No Catalogs Found for Source (' + dataName + ').'
                    );
                }
                return catalogs;
            });
        case 'system':
            return waterline.nodes.findOne({ 
                or: [
                    {id: identifier}, 
                    {name: {'contains': identifier}}
                ]
            }).then(function(node) {
                if(!node) {
                    throw new Errors.NotFoundError('Cound not find node with id ' + identifier);
                }
                return _.filter(node.relations, function(relation) {
                    return relation.relationType === 'encloses';
                }).map(function(relation) {
                    return relation.targets[0];
                });
            });
        case 'chassis':
            return waterline.nodes.findOne({ 
                or: [
                    {id: identifier}, 
                    {name: {'contains': identifier}}
                ]
            }).then(function(node) {
                if(!node) {
                    throw new Errors.NotFoundError('Cound not find node with id ' + identifier);
                }
                return _.filter(node.relations, function(relation) {
                    return relation.relationType === 'encloses';
                }).map(function(relation) {
                    return relation.targets;
                });
            })
            .then(function(targets) {
                if(targets) {
                    return targets[0];
                }
            });
        case 'chassisData':
            return waterline.workitems.findPollers({node: identifier})
            .filter(function(poller) {
                return poller.config.command === 'chassis';
            }).spread(function(poller) {
                return taskProtocol.requestPollerCache(poller.id, { latestOnly: true });
            }).then(function(data) {
                var chassisData = data[0].chassis;
                chassisData.power = (chassisData.power) ? 'On' : 'Off';
                var uidStatus = ['Off', 'Temporary On', 'On',  'Reserved'];
                var validEnum = ['Off', 'Blinking',     'Lit', 'Unknown']; // map to valid redfish value
                chassisData.uid = validEnum[_.indexOf(uidStatus, chassisData.uid)];
                return chassisData;
            });
        case 'sdrData':
            return waterline.workitems.findPollers({node: identifier})
            .filter(function(poller) {
                return poller.config.command === 'sdr';
            }).spread(function(poller) {
                return taskProtocol.requestPollerCache(poller.id, { latestOnly: true });
            }).then(function(data) {
                return data[0].sdr;
            });
    }
};

var listChassis = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);
    options.nodes = [];

    return Promise.each(waterline.nodes.find({type: 'enclosure'}), function(node) {
        options.nodes.push(node.id);
        var sn = node.name.match(/Enclosure Node ([a-zA-Z0-9_-]*)/);
        if(sn) {
            options.nodes.push(sn[1]);
        }
    }).then(function() {
        return redfish.render('redfish.1.0.0.chassiscollection.json', 
                            'ChassisCollection.json#/definitions/ChassisCollection',
                            options);
    }).catch(function(error) {
        return redfish.handleError(error, res);
    });
});

var getChassis = controller(function(req, res) {
    var options = redfish.makeOptions(req, res, req.swagger.params.identifier.value);
    options.chassisType = 'Other';
    var typeEnum = [
        "Rack",
        "Blade",
        "Enclosure",
        "StandAlone",
        "Stand Alone",
        "RackMount",
        "Rack Mount",
        "Card",
        "Cartridge",
        "Row",
        "Pod",
        "Expansion",
        "Sidecar",
        "Zone",
        "Sled",
        "Shelf",
        "Drawer",
        "Module",
        "Component",
        "Other" ];

    return dataFactory(options.identifier, 'system')
        .then(function(system) {
            return Promise.all([ 
                dataFactory(options.identifier, 'chassis'),
                dataFactory(system, 'ohai'),
                dataFactory(system, 'chassisData') 
            ]);
        }).spread(function(chassis,ohai,chassisData) {
            _.forEach(typeEnum,function(type) {
                var re = new RegExp(type, 'g');
                var match = ohai.data.dmi.chassis.type.match(re);
                if (match) {
                    options.chassisType = match.toString().replace(/ /g,'');
                }
            });
            options.chassisData = chassisData;
            options.ohai = ohai;
            options.targetList = chassis || [];
            return Promise.map(options.targetList, function(system) {
                return waterline.nodes.findByIdentifier(system);
            });
        }).then(function(systems) {
            options.obm = _.reduce(systems, function(arr, val) {
                _.forEach(val.obmSettings, function(item, idx) {
                    arr.push(val.id + '.' + idx);
                });
                return arr;
            }, ['RackHD']);
            return redfish.render('redfish.1.0.0.chassis.1.0.0.json', 
                            'Chassis.1.0.0.json#/definitions/Chassis',
                            options);
        }).catch(function(error) {
            return redfish.handleError(error, res);
        });
});

var getThermal = controller(function(req, res) {
    var options = redfish.makeOptions(req, res, req.swagger.params.identifier.value);

    return dataFactory(options.identifier, 'system')
        .then(function(system) {
            return dataFactory(system, 'sdrData');
        }).then(function(sdrData) {
            var tempList = [], 
                fanList = [];
            _.forEach(sdrData,function(sdr) {
                if (sdr.sensorType === 'Temperature') {
                    tempList.push(sdr);
                }
                if (sdr.sensorType === 'Fan' ) {
                    fanList.push(sdr);
                }
            });
            options.tempList = tempList;
            options.fanList = fanList;
            return redfish.render('redfish.1.0.0.thermal.1.0.0.json', 
                            'Thermal.1.0.0.json#/definitions/Thermal',
                            options);
        }).catch(function(error) {
            return redfish.handleError(error, res);
        });
});

var getPower = controller(function(req, res) {
    var options = redfish.makeOptions(req, res, req.swagger.params.identifier.value);
    
    return dataFactory(options.identifier, 'system')
        .then(function(system) {
            return dataFactory(system, 'sdrData');
        }).then(function(sdrData) {
            var voltageList = [], 
                wattsList = [];
            _.forEach(sdrData,function(sdr) {
                if (sdr.sensorType === 'Voltage') {
                    voltageList.push(sdr);
                }
                if (sdr.sensorReadingUnits === 'Watts') {
                    wattsList.push(sdr);
                }
            });
            options.voltageList = voltageList;
            options.wattsList = wattsList;
            return redfish.render('redfish.1.0.0.power.1.0.0.json', 
                            'Power.1.0.0.json#/definitions/Power',
                            options);
        }).catch(function(error) {
            return redfish.handleError(error, res);
        });
});

module.exports = {
    listChassis: listChassis,
    getChassis: getChassis,
    getThermal: getThermal,
    getPower: getPower
};
