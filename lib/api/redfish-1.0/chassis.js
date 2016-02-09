// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var redfish = injector.get('Http.Api.Services.Redfish');
var _ = injector.get('_'); // jshint ignore:line
var waterline = injector.get('Services.Waterline');
var Promise = injector.get('Promise'); // jshint ignore:line
var Errors = injector.get('Errors');
var taskProtocol = injector.get('Protocol.Task');
var basepath = '/redfish/v1';
var Errors = injector.get('Errors');

module.exports = {
    listChassis: listChassis,
    getChassis: getChassis,
    getThermal: getThermal,
    getPower: getPower
};

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
                return _.filter(node.relations, function(relation) {
                    return relation.relationType === 'encloses';
                }).map(function(relation) {
                    return relation.targets;
                });
            })
            .then(function(targets) {
                return targets[0];
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

function listChassis(req, res) {
    var options = {};
    options.basepath = basepath;
    options.templateScope = ['global'];
    options.url = req.url;
    options.nodes = [];
    
    Promise.each(waterline.nodes.find({type: 'enclosure'}), function(node) {
        options.nodes.push(node.id);
        var sn = node.name.match(/Enclosure Node ([a-zA-Z0-9_-]*)/);
        if(sn) {
            options.nodes.push(sn[1]);
        }
    }).then(function() {
        return redfish.render('redfish.1.0.0.chassiscollection.json', 
                            'ChassisCollection.json#/definitions/ChassisCollection',
                            options);
    }).then(function(output) {
        res.status(200).json(output);
    })
    .catch(function(error) {
        res.status(500).json(error);
    });
}

function getChassis(req, res) {
    var identifier = req.swagger.params.identifier.value;
    var options = {};
    options.basepath = basepath;
    options.templateScope = ['global'];
    options.url = req.url;
    options.identifier = identifier;
    options.chassisType = "Other";
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

    dataFactory(identifier, 'system')
    .spread(function(system) {
        return Promise.all([ dataFactory(identifier, 'chassis'),
                      dataFactory(system, 'ohai'),
                      dataFactory(system, 'chassisData') ]);
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
        return redfish.render('redfish.1.0.0.chassis.1.0.0.json', 
                        'Chassis.1.0.0.json#/definitions/Chassis',
                        options);
    }).then(function(output) {
        res.status(200).json(output);
    }).catch(function(error) {
        res.status(500).json(error);
    });
}

function getThermal(req, res) {
    var identifier = req.swagger.params.identifier.value;
    var options = {};
    options.basepath = basepath;
    options.templateScope = ['global'];
    options.url = req.url;
    options.identifier = identifier;
    
    dataFactory(identifier, 'system')
    .then(function(system) {
        return Promise.all([ dataFactory(system, 'sdrData') ]);
    }).spread(function(sdrData) {
        var tempList = [], 
            fanList = [];
        _.forEach(sdrData,function(sdr) {
            if (sdr['Sensor Type'] === 'Temperature') {
                tempList.push(sdr);
            }
            if (sdr['Sensor Type'] === 'Fan' ) {
                fanList.push(sdr);
            }
        });
        options.tempList = tempList;
        options.fanList = fanList;
        return redfish.render('redfish.1.0.0.thermal.1.0.0.json', 
                        'Thermal.1.0.0.json#/definitions/Thermal',
                        options);
    }).then(function(output) {
        res.status(200).json(output);
    })
    .catch(function(error) {
        res.status(500).json(error);
    });
}

function getPower(req, res) {
    var identifier = req.swagger.params.identifier.value;
    var options = {};
    options.basepath = basepath;
    options.templateScope = ['global'];
    options.url = req.url;
    options.identifier = identifier;
    
    dataFactory(identifier, 'system')
    .then(function(system) {
        return Promise.all([ dataFactory(system, 'sdrData') ]);
    }).spread(function(sdrData) {
        var voltageList = [], 
            wattsList = [];
        _.forEach(sdrData,function(sdr) {
            if (sdr['Sensor Type'] === 'Voltage') {
                voltageList.push(sdr);
            }
            if (sdr['Sensor Reading Units'] === 'Watts') {
                wattsList.push(sdr);
            }
        });
        options.voltageList = voltageList;
        options.wattsList = wattsList;
        return redfish.render('redfish.1.0.0.power.1.0.0.json', 
                        'Power.1.0.0.json#/definitions/Power',
                        options);
    }).then(function(output) {
        res.status(200).json(output);
    })
    .catch(function(error) {
        res.status(500).json(error);
    });
}

