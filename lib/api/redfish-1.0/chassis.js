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
var env = injector.get('Services.Environment');
var nodeApi = injector.get('Http.Services.Api.Nodes');

/*
 * This mapping is used by the Redfish Chassis logic to determine what 
 * sensors should be displayed in the chassis object representing the
 * enclosure vs. what sensors should be displayed in the chassis object
 * representing the blade element.  Entities that are specific to the
 * blade are filtered out of the enclosure by default.
 *
 * This value can be overridden on a sku basis via the redfish.sensorFilter
 * value.
 */
var EntityIdFilterDefaults = [
    '3', // processor
    '7', // system board
    '8', // memory module
    '66' // baseboard
];

function _getEnclosedSystems(node) {
    return _(node.relations)
        .filter({relationType: 'encloses'})
        .pluck('targets')
        .flattenDeep()
        .value();
}

var dataFactory = function(identifier, dataName) {
    switch(dataName)  {
        case 'catData':
            return nodeApi.getNodeCatalogSourceById(identifier, 'ohai')
                .then(function(catalog) {
                    var catData = {
                        chassis: {
                            asset_tag: catalog.data.dmi.chassis.asset_tag,
                            manufacturer: catalog.data.dmi.chassis.manufacturer,
                            sku_number: catalog.data.dmi.chassis.sku_number,
                            serial_number: catalog.data.dmi.chassis.serial_number,
                            type: catalog.data.dmi.chassis.type
                        },
                        system: {
                            product_name: catalog.data.dmi.system.product_name
                        }
                    };
                    return catData;
                })
                .catch(function(err) {
                    if (err instanceof Errors.NotFoundError) {
                        //If ohai catalog not found look for UCS chassis data catalog
                        return nodeApi.getNodeCatalogSourceById(identifier, 'UCS')
                        .then(function(catalog) {
                            var catData = {
                                chassis: {
                                    asset_tag: '',
                                    manufacturer: catalog.data.vendor,
                                    sku_number: '',
                                    serial_number: catalog.data.serial,
                                    type: (_.includes(catalog.data.rn, 'chassis')) ? 'Enclosure' : 'Other'
                                },
                                system: {
                                    product_name: catalog.data.model
                                }
                            };
                            return catData;
                        });
                    }
                    throw err;
                });
        case 'system':
            return nodeApi.getNodeById(identifier)
            .then(function(node) {
                return _.filter(node.relations, function(relation) {
                    return relation.relationType === 'encloses';
                }).map(function(relation) {
                    return relation.targets[0];
                });
            });
        case 'chassis':
            return nodeApi.getNodeById(identifier)
            .then(function(node) {
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
            return nodeApi.getPollersByNodeId(identifier)
            .filter(function(poller) {
                return poller.config.command === 'chassis';
            }).spread(function(poller) {
                if (poller) {
                    return taskProtocol.requestPollerCache(poller.id, { latestOnly: true })
                    .then(function(data) {
                        var chassisData = data[0].chassis;
                        chassisData.power = (chassisData.power) ? 'On' : 'Off';
                        var uidStatus = ['Off', 'Temporary On', 'On',  'Reserved'];
                        var validEnum = ['Off', 'Blinking',     'Lit', 'Unknown']; // map to valid redfish value
                        chassisData.uid = validEnum[_.indexOf(uidStatus, chassisData.uid)];
                        return chassisData;
                    });
                }
                else {
                    //If no pollers found check for UCS chassis data catalog to get the power and uid LEDs
                    var chassisData;
                    return nodeApi.getNodeCatalogSourceById(identifier, 'UCS')
                    .then(function(catalog) {
                        chassisData = catalog.data;
                        chassisData.power = (chassisData.power === 'ok') ? 'On' : 'Off';
                        return nodeApi.getNodeCatalogSourceById(identifier, 'UCS:locator-led');
                    })
                    .then(function(catalog) {
                        chassisData.uid = (catalog.data.oper_state === 'on') ? 'Lit' : 'Off';
                        return chassisData;
                    })
                    .catch(function(err) {
                        if (err instanceof Errors.NotFoundError) {
	                    chassisData.uid = 'Unknown';
			    return chassisData;
                        }
                        throw err;
                    });
                }
            });
        case 'sdrData':
            return nodeApi.getPollersByNodeId(identifier)
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

    return Promise.each(nodeApi.getAllNodes({type: 'enclosure'}), function(node) {
        options.nodes.push(node);

        return Promise.each(_getEnclosedSystems(node), function(objId) {
            return waterline.nodes.findByIdentifier(objId)
            .then(function(obj) {
                return env.get('config.redfish.computeType', 'Other', obj && obj.sku ? [ obj.sku ] : null );
            })
            .then(function(val) {
                if(val === 'Blade') {
                    options.nodes.push(node.id + '.' + objId);
                }
            });
        });
    }).then(function() {
        return redfish.render('redfish.1.0.0.chassiscollection.json', 
                            'ChassisCollection.json#/definitions/ChassisCollection',
                            options);
    }).catch(function(error) {
        return redfish.handleError(error, res);
    });
});

var getChassis = controller(function(req, res) {
    var chassisId = req.swagger.params.identifier.value.split('.')[0];
    var systemId = req.swagger.params.identifier.value.split('.')[1];
    var options = redfish.makeOptions(req, res, req.swagger.params.identifier.value);
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

    return Promise.all([
        nodeApi.getNodeById(chassisId),
        systemId ? nodeApi.getNodeById(systemId) : null
    ])
    .tap(function(nodes) {
        if(!nodes[1]) {
            return Promise.each(_getEnclosedSystems(nodes[0]), function(objId) {
                return waterline.nodes.findByIdentifier(objId)
                .then(function(obj) {
                    return env.get('config.redfish.computeType', 'Other', obj && obj.sku ? [ obj.sku ] : null );
                })
                .then(function(val) {
                    if(val === 'Blade') {
                        options.contains = options.contains || [];
                        options.contains.push(nodes[0].id + '.' + objId);
                        options.chassisType = 'Enclosure';
                    }
                });
            });
        } else {
            if(_.includes(_getEnclosedSystems(nodes[0]), systemId)) {
                options.containedBy = chassisId;
                options.chassisType = 'Blade';
            }
        }
    })
    .spread(function(chassisNode) {
        var systems = _getEnclosedSystems(chassisNode);
        var chassisName = chassisNode.name;
        if(!_.isEmpty(systems)) {
            if (chassisName.indexOf("sys/chassis")!== -1)
            {
                return Promise.props({
                    systems: Promise.map(systems, nodeApi.getNodeById.bind(nodeApi)),
                    catData: dataFactory(chassisNode.id, 'catData'),
                    chassisData: dataFactory(chassisNode.id, 'chassisData')

                });
            }
            else
            {
                return Promise.props({
                    systems: Promise.map(systems, nodeApi.getNodeById.bind(nodeApi)),
                    catData: dataFactory(systemId || systems[0], 'catData'),
                    chassisData: dataFactory(systemId || systems[0], 'chassisData')
                });
            }

        }
        return {};
    })
    .then(function(obj) {
        if(!_.get(options, 'chassisType')) {
            options.chassisType = 'Other';
            _.forEach(typeEnum,function(type) {
                var re = new RegExp(type, 'g');
                var match = obj.catData.chassis.type.match(re);
                if (match) {
                    options.chassisType = match.toString().replace(/ /g,'');
                }
            });
        }

        options.obm = ['RackHD'];
        options.targetList = [];
        _.forEach(obj.systems, function(system) {
            options.targetList.push(system.id);
        });
        return redfish.render('redfish.1.0.0.chassis.1.0.0.json', 
                        'Chassis.v1_4_0.json#/definitions/Chassis',
                        _.merge({}, obj, options));
    })
    .catch(function(error) {
        return redfish.handleError(error, res);
    });
});

var getThermal = controller(function(req, res) {
    var chassisId = req.swagger.params.identifier.value.split('.')[0];
    var systemId = req.swagger.params.identifier.value.split('.')[1];
    var options = redfish.makeOptions(req, res, req.swagger.params.identifier.value);

    return dataFactory(chassisId, 'system')
    .then(function(system) {
        return Promise.all([
            dataFactory(systemId || system, 'sdrData'),
            waterline.nodes.findByIdentifier(systemId || system)
            .then(function(obj) {
                return env.get('config.redfish', '{}', obj && obj.sku ? [ obj.sku ] : null );
            })
        ]);
    })
    .spread(function(sdrData, redfishCfg) {
        var defaultFilter = (_.get(redfishCfg, 'computeType') === 'Blade') ? EntityIdFilterDefaults : [];
        var sensorFilter = _.get(redfishCfg, 'sensorFilter', defaultFilter);
        options.tempList = [];
        options.fanList = [];
        _.forEach(sdrData,function(sdr) {
            var included = _.includes(sensorFilter, sdr.entityId.split('.')[0]);
            if(systemId ? included : !included ) {
                if (sdr.sensorType === 'Temperature') {
                    options.tempList.push(sdr);
                }
                if (sdr.sensorType === 'Fan' ) {
                    options.fanList.push(sdr);
                }
            }
        });

        return redfish.render('redfish.1.0.0.thermal.1.0.0.json', 
                        'Thermal.v1_2_0.json#/definitions/Thermal',
                        options);
    }).catch(function(error) {
        return redfish.handleError(error, res);
    });
});

var getPower = controller(function(req, res) {
    var chassisId = req.swagger.params.identifier.value.split('.')[0];
    var systemId = req.swagger.params.identifier.value.split('.')[1];
    var options = redfish.makeOptions(req, res, req.swagger.params.identifier.value);

    return dataFactory(chassisId, 'system')
    .then(function(system) {
        return Promise.all([
            dataFactory(systemId || system, 'sdrData'),
            waterline.nodes.findByIdentifier(systemId || system)
            .then(function(obj) {
                return env.get('config.redfish', '{}', obj && obj.sku ? [ obj.sku ] : null );
            })
        ]);
    })
    .spread(function(sdrData, redfishCfg) {
        var defaultFilter = (_.get(redfishCfg, 'computeType') === 'Blade') ? EntityIdFilterDefaults : [];
        var sensorFilter = _.get(redfishCfg, 'sensorFilter', defaultFilter);
        options.voltageList = [];
        options.wattsList = [];
        _.forEach(sdrData,function(sdr) {
            var included = _.includes(sensorFilter, sdr.entityId.split('.')[0]);
            if(systemId ? included : !included ) {
                if (sdr.sensorType === 'Voltage') {
                    options.voltageList.push(sdr);
                }
                if (sdr.sensorReadingUnits === 'Watts') {
                    options.wattsList.push(sdr);
                }
            }
        });

        return redfish.render('redfish.1.0.0.power.1.0.0.json', 
                        'Power.v1_2_1.json#/definitions/Power',
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
