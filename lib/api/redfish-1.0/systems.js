// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var redfish = injector.get('Http.Api.Services.Redfish');
var schemaApi = injector.get('Http.Api.Services.Schema');
var waterline = injector.get('Services.Waterline');
var taskProtocol = injector.get('Protocol.Task');
var Promise = injector.get('Promise');    // jshint ignore:line
var _ = injector.get('_');                // jshint ignore:line
var nodeApi = injector.get('Http.Services.Api.Nodes');
var controller = injector.get('Http.Services.Swagger').controller;
var Errors = injector.get('Errors');
var moment = require('moment');

var dataFactory = function(identifier, dataName) {
    switch(dataName)  {
        case 'ohai':
        case 'dmi':
        case 'smart':
            return nodeApi.getNodeCatalogSourceById(identifier, dataName);

        case 'chassis':
            return nodeApi.getNodeById(identifier)
            .then(function(node) {
                return _.filter(node.relations, function(relation) {
                    return relation.relationType === 'enclosedBy';
                }).map(function(relation) {
                    return relation.targets[0];
                });
            });

        case 'chassisData':
            return nodeApi.getPollersByNodeId(identifier)
            .filter(function(poller) {
                return poller.config.command === 'chassis';
            }).spread(function(poller) {
                return taskProtocol.requestPollerCache(poller.id, { latestOnly: true });
            }).then(function(data) {
                var chassisData = data[0].chassis;
                chassisData.power = (chassisData.power) ? 'On' : 'Off';
                var uidStatus = ['Off', 'Temporary On', 'On',  'Reserved'];
                var validEnum = ['Off', 'Blinking',     'Lit', 'Unknown'];
                chassisData.uid = validEnum[_.indexOf(uidStatus, chassisData.uid)];
                return chassisData;
            }).catch(function() {
                return { power: "Unknown", uid: "Unknown"};
            });

        case 'selInfoData':
            return nodeApi.getPollersByNodeId(identifier)
            .filter(function(poller) {
                return poller.config.command === 'selInformation';
            }).spread(function(poller) {
                return taskProtocol.requestPollerCache(poller.id, { latestOnly: true });
            }).then(function(data) {
                return data[0].selInformation;
            });

        case 'selData':
            return nodeApi.getPollersByNodeId(identifier)
            .filter(function(poller) {
                return poller.config.command === 'sel';
            }).spread(function(poller) {
                return taskProtocol.requestPollerCache(poller.id, { latestOnly: true });
            }).then(function(data) {
                return data[0].sel;
            });
    }
};

var selTranslator = function(selArray, identifier) {
    var dateRegex = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
    var timeRegex = /(\d{1,2}):(\d{1,2}):(\d{1,2})/;
    var ipmiEventTypeMap = {
        'Asserted': 'Assert',
        'Deasserted': 'Deassert',
        'Lower Non-critical going low': 'Lower Non-critical - going low',
        'Lower Non-critical going high': 'Lower Non-critical - going high',
        'Lower Critical going low': 'Lower Critical - going low',
        'Lower Critical going high': 'Lower Critical - going high',
        'Lower Non-recoverable going low': 'Lower Non-recoverable - going low',
        'Lower Non-recoverable going high': 'Lower Non-recoverable - going high',
        'Upper Non-critical going low': 'Upper Non-critical - going low',
        'Upper Non-critical going high': 'Upper Non-critical - going high',
        'Upper Critical going low': 'Upper Critical - going low',
        'Upper Critical going high': 'Upper Critical - going high',
        'Upper Non-recoverable going low': 'Upper Non-recoverable - going low',
        'Upper Non-recoverable going high': 'Upper Non-recoverable - going high',
        'Predictive Failure Deasserted': 'Predictive Failure deasserted',
        'Predictive Failure Asserted': 'Predictive Failure asserted',
        'Transition to Non-critical from OK': 'Transition to Non-Critical from OK',
        'Device Absent': 'Device Removed / Device Absent',
        'Device Present': 'Device Inserted / Device Present',
        'Non-Redundant: Sufficient from Redundant': 'Non-redundant:Sufficient Resources from Redundant',
        'Non-Redundant: Sufficient from Insufficient': 'Non-redundant:Sufficient Resources from Insufficient Resources',
        'Non-Redundant: Insufficient Resources': 'Non-redundant:Insufficient Resources',
        'Redundancy Degraded from Fully Redundant': 'Redundancy Degraded from Fully Redundant',
        'Redundancy Degraded from Non-Redundant': 'Redundancy Degraded from Fully Redundant'
    };
    var ipmiSensorTypeMap = {
        'Temperature': 'Temperature',
        'Voltage': 'Voltage',
        'Current': 'Current',
        'Fan': 'Fan',
        'Physical Security': 'Physical Chassis Security',
        'Platform Security': 'Platform Security Violation Attempt',
        'Processor': 'Processor',
        'Power Supply': 'Power Supply / Converter',
        'Power Unit': 'PowerUnit',
        'Cooling Device': 'CoolingDevice',
        'Memory': 'Memory',
        'Drive Slot': 'Drive Slot/Bay',
        'System Firmware Progress': 'System Firmware Progress',
        'Event Logging Disabled': 'Event Logging Disabled',
        'Watchdog 1': 'Watchdog',
        'System Event': 'System Event',
        'Critical Interrupt': 'Critical Interrupt',
        'Button': 'Button/Switch',
        'Module/Board': 'Module/Board',
        'Microcontroller/Coprocessor': 'Microcontroller/Coprocessor',
        'Add-in Card': 'Add-in Card',
        'Chassis': 'Chassis',
        'Chip Set': 'ChipSet',
        'Other FRU': 'Other FRU',
        'Cable/Interconnect': 'Cable/Interconnect',
        'Terminator': 'Terminator',
        'System Boot Initiated': 'SystemBoot/Restart',
        'Boot Error': 'Boot Error',
        'OS Boot': 'BaseOSBoot/InstallationStatus',
        'OS Stop/Shutdown': 'OS Stop/Shutdown',
        'Slot/Connector': 'Slot/Connector',
        'System ACPI Power State': 'System ACPI PowerState',
        'Watchdog 2': 'Watchdog',
        'Platform Alert': 'Platform Alert',
        'Entity Presence': 'Entity Presence',
        'Monitor ASIC/IC': 'Monitor ASIC/IC',
        'LAN': 'LAN',
        'Management Subsystem Health': 'Management Subsystem Health',
        'Battery': 'Battery',
        'Version Change': 'Version Change',
        'FRU State': 'FRUState'
    };
    var selTranslatorOrigin = function(sensorType, identifier) {
        switch(sensorType) {
        case 'Drive Slot':
            return '/redfish/v1/Systems/' + identifier + '/SimpleStorage';
        case 'Power Unit':
            return dataFactory(identifier, 'chassis')
                .then(function(chassis) {
                    return '/redfish/v1/Chassis/' + chassis + '/Power/Voltages';
                });
        case 'Power Supply':
            return dataFactory(identifier, 'chassis')
                .then(function(chassis) {
                    return '/redfish/v1/Chassis/' + chassis + '/Power/PowerSupplies';
                });
        case 'Fan':
            return dataFactory(identifier, 'chassis')
                .then(function(chassis) {
                    return '/redfish/v1/Chassis/' + chassis + '/Thermal/Fans';
                });
        case 'Temperature':
            return dataFactory(identifier, 'chassis')
                .then(function(chassis) {
                    return '/redfish/v1/Chassis/' + chassis + '/Thermal/Temperatures';
                });
        }
        return null;
    };

    return Promise.map(selArray, function(entry) {
        var dates = dateRegex.exec(entry.date);
        var times = timeRegex.exec(entry.time);
        return Promise.props({
            logId: entry.logId,
            timestamp: moment.utc([dates[3], dates[1], dates[2], times[1], times[2], times[3]]).format(),
            sensorType: _.get(ipmiSensorTypeMap, entry.sensorType, 'Other Units-based Sensor'),
            value: _.get(ipmiEventTypeMap, entry.value, entry.value),
            event: entry.event,
            sensorNumber: parseInt(entry.sensorNumber.substr(1)),
            origin: selTranslatorOrigin(entry.sensorType, identifier)
        });
    });
};

/**
 * Generate a list of systems managed by RackHD
 * @param  {Object}     req
 * @param  {Object}     res
 */
var listSystems = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);
    return waterline.nodes.find({type: 'compute'}).then(function(nodes) {
        options.nodes = nodes;
        return redfish.render('redfish.1.0.0.computersystemcollection.json',
                            'ComputerSystemCollection.json#/definitions/ComputerSystemCollection',
                            options);
    }).catch(function(error) {
        return redfish.handleError(error, res);
    });
});

/**
 * Generate information about a specific system
 * @param  {Object}     req
 * @param  {Object}     res
 */
var getSystem = controller(function(req, res) {
    var identifier = req.swagger.params.identifier.value;
    var options = redfish.makeOptions(req, res, identifier);
    options.systemType = 'Physical';

    return Promise.props({
        ohai: dataFactory(identifier, 'ohai'),
        dmi: dataFactory(identifier, 'dmi'),
        chassis: dataFactory(identifier, 'chassis'),
        chassisData: dataFactory(identifier, 'chassisData'),
        obm: waterline.nodes.needByIdentifier(identifier)
            .then(function(node) {
                return _.map(node.obmSettings, function(val, idx) {
                    return node.id + '.' + idx;
                });
            })
            .then(function(obms) {
                obms.push('RackHD');
                return obms;
            })
    }).then(function(data) {
        return redfish.render('redfish.1.0.0.computersystem.1.0.0.json',
                        'ComputerSystem.1.0.0.json#/definitions/ComputerSystem',
                        _.merge(options, data));
    }).catch(function(error) {
        return redfish.handleError(error, res);
    });
});

/**
 * Generate information about the processors of a specific system
 * @param  {Object}     req
 * @param  {Object}     res
 */
var listSystemProcessors = controller(function(req, res)  {
    var identifier = req.swagger.params.identifier.value;
    var options = redfish.makeOptions(req, res, identifier);
    return dataFactory(identifier, 'dmi').then(function(dmi) {
        options.dmi = dmi;
        return redfish.render('redfish.1.0.0.processorcollection.json',
                        'ProcessorCollection.json#/definitions/ProcessorCollection',
                        options);
    }).catch(function(error) {
        return redfish.handleError(error, res);
    });
});

/**
 * Generate specific information about the processors of a specific system
 * @param  {Object}     req
 * @param  {Object}     res
 */
var getSystemProcessor = controller(function(req, res)  {
    var identifier = req.swagger.params.identifier.value;
    var options = redfish.makeOptions(req, res, identifier);

    return Promise.props({
        socketId: req.swagger.params.socket.value,
        dmi: dataFactory(identifier, 'dmi'),
        ohai: dataFactory(identifier, 'ohai')
    }).then(function(data) {
        if(!_.has(data.ohai.data.cpu, data.socketId)) {
            throw new Errors.NotFoundError('invalid socketId');
        }
        return redfish.render('redfish.1.0.0.processor.1.0.0.json',
                        'Processor.1.0.0.json#/definitions/Processor',
                        _.merge(options, data));
    }).catch(function(error) {
        return redfish.handleError(error, res);
    });
});

/**
 * Generate information about the storage adapters of a specific system
 * @param  {Object}     req
 * @param  {Object}     res
 */
var listSimpleStorage = controller(function(req, res)  {
    var identifier = req.swagger.params.identifier.value;
    var options = redfish.makeOptions(req, res, identifier);

    return Promise.all([ dataFactory(identifier, 'dmi'),
                         dataFactory(identifier, 'smart') ])
        .spread(function(dmi, smart) {
            options.dmi = dmi;

            var controllers = {};
            _.forEach(smart.data, function(ele) {
                var id = ele.Controller.controller_PCI_BDF.replace(/[:.]/g, '_');  // jshint ignore: line
                if(!(id in controllers)) {
                    controllers[id] = [];
                }
                controllers[id].push(ele);
            });

            var ids = [];
            _.forOwn(controllers, function(val, key) { ids.push(key); });
            options.controllers = ids;

            return redfish.render('redfish.1.0.0.simplestoragecollection.json',
                            'SimpleStorageCollection.json#/definitions/SimpleStorageCollection',
                            options);
    }).catch(function(error) {
        return redfish.handleError(error, res);
    });
});

/**
 * Generate information about the storage devices on an adapter of a specific system
 * @param  {Object}     req
 * @param  {Object}     res
 */
var getSimpleStorage = controller(function(req, res)  {
    var identifier = req.swagger.params.identifier.value;
    var index = req.swagger.params.index.value;
    var options = redfish.makeOptions(req, res, identifier);

    options.index = index;

    return Promise.all([ dataFactory(identifier, 'dmi'),
                  dataFactory(identifier, 'smart') ])
        .spread(function(dmi, smart) {
            options.dmi = dmi;
            var controllers = {};
            _.forEach(smart.data, function(ele) {
                var id = ele.Controller.controller_PCI_BDF.replace(/[:.]/g, '_'); // jshint ignore: line
                if(!(id in controllers)) {
                    controllers[id] = [];
                }
                controllers[id].push(ele);
            });

            options.controller = controllers[index][0].Controller;
            options.devices = [];
            _.forEach(controllers[index], function(ele) {
                options.devices.push(ele.SMART);
            });

            return redfish.render('redfish.1.0.0.simplestorage.1.0.0.json',
                            'SimpleStorage.1.0.0.json#/definitions/SimpleStorage',
                            options);
    }).catch(function(error) {
        return redfish.handleError(error, res);
    });
});

/**
 * Generate information about the log services available for a system
 * @param  {Object}     req
 * @param  {Object}     res
 */
var listLogService = controller(function(req, res)  {
    var identifier = req.swagger.params.identifier.value;
    var options = redfish.makeOptions(req, res, identifier);

    options.logSource = ['sel'];
    return redfish.render('redfish.1.0.0.logservicecollection.json',
                 'LogServiceCollection.json#/definitions/LogServiceCollection',
                  options)
    .catch(function(error) {
        return redfish.handleError(error, res);
    });
});

/**
 * Generate information about the log service provider for a system
 * @param  {Object}     req
 * @param  {Object}     res
 */
var getSelLogService = controller(function(req, res)  {
    var identifier = req.swagger.params.identifier.value;
    var options = redfish.makeOptions(req, res, identifier);

    options.type = 'SEL';
    options.description = 'IPMI System Event Log';
    options.name = 'ipmi-sel-information';
    options.log = {};

    return dataFactory(identifier, 'selInfoData')
        .then(function(sel) {
            options.log.size = sel['# of Alloc Units'] || 0;
            options.log.policy = sel.Overflow && sel.Overflow === 'false' ?
                'WrapsWhenFull' :
                'NeverOverWrites';
            options.log.lastWriteDate = sel['Last Add Time'] || 'Unknown';
            return redfish.render('redfish.1.0.0.logservice.1.0.0.json',
                            'LogService.1.0.0.json#/definitions/LogService',
                            options);
    }).catch(function(error) {
        return redfish.handleError(error, res);
    });
});

/**
 * Generate information about the log entries of a log service for a system
 * @param  {Object}     req
 * @param  {Object}     res
 */
var listSelLogServiceEntries = controller(function(req, res)  {
    var identifier = req.swagger.params.identifier.value;
    var options = redfish.makeOptions(req, res, identifier);

    options.type = 'SEL';

    return dataFactory(identifier, 'selData')
    .then(function(selData) {
        if(selData) {
            return selTranslator(selData, identifier);
        }
        return [];
    })
    .then(function(selData) {
        options.logEntries = selData;
        return redfish.render('redfish.1.0.0.logentrycollection.json',
                        'LogEntryCollection.json#/definitions/LogEntryCollection',
                        options);
    }).catch(function(error) {
        return redfish.handleError(error, res);
    });
});

/**
 * Generate information about a specific log entry for a system
 * @param  {Object}     req
 * @param  {Object}     res
 */
var getSelLogServiceEntry = controller(function(req, res)  {
    var identifier = req.swagger.params.identifier.value;
    var entryId = req.swagger.params.entryId.value;
    var options = redfish.makeOptions(req, res, identifier);

    options.type = 'SEL';
    options.description = 'IPMI System Event Log';
    options.name = 'ipmi-sel-information';
    options.log = {};

    return dataFactory(identifier, 'selData')
    .then(function(selData) {
        options.entries = _.filter(selData, function(entry) {
            return entry.logId === entryId;
        });
        if(!options.entries.length) {
            throw new Errors.NotFoundError('sel entry ' + entryId + ' was not found');
        }
        return selTranslator(options.entries, identifier);
    })
    .then(function(selData) {
        options.entries = selData;
        options.entry = options.entries[0];
        return redfish.render('redfish.1.0.0.logentry.1.0.0.json',
                        'LogEntry.1.0.0.json#/definitions/LogEntry',
                        options);
    }).catch(function(error) {
        return redfish.handleError(error, res);
    });
});

/**
 * Generate information about available reset types for a system
 * @param  {Object}     req
 * @param  {Object}     res
 */
var listResetTypes = controller(function(req, res) {
    var identifier = req.swagger.params.identifier.value;
    var options = redfish.makeOptions(req, res, identifier);

    return redfish.get('redfish.1.0.0.rackhd.reset.actions.json', options)
    .catch(function(error) {
        return redfish.handleError(error, res);
    });
});

/**
 * Perform the specified reset operation on the system
 * @param  {Object}     req
 * @param  {Object}     res
 */
var doReset = controller(function(req,res) {
    var identifier = req.swagger.params.identifier.value;
    var options = redfish.makeOptions(req, res, identifier);
    var payload = req.swagger.params.payload.value;

    return schemaApi.validate(payload, 'RackHD.ResetAction.json#/definitions/ResetAction')
    .then(function(result) {
        var map = {
            On: 'Graph.PowerOn.Node',
            ForceOff: 'Graph.PowerOff.Node',
            GracefulRestart: 'Graph.Reset.Soft.Node',
            ForceRestart: 'Graph.Reboot.Node',
            ForceOn: 'Graph.PowerOn.Node',
            PushPowerButton: 'Graph.Reset.Soft.Node'
        };

        if(result.error) {
            throw new Error(result.error);
        }

        if(!_.has(map, payload.reset_type))  {    // jshint ignore:line
            throw new Error('value not found in map');
        }
        return nodeApi.setNodeWorkflowById({
            name: map[payload.reset_type]    // jshint ignore:line
        }, identifier);
    })
    .then(function(data) {
        return {
            '@odata.id': options.basepath + '/TaskService/Tasks/' + data.instanceId
        };
    })
    .then(function(output) {
        res.setHeader('Location', output['@odata.id']);
        res.status(201).json(output);
    })
    .catch(function(error) {
        return redfish.handleError(error, res);
    });
});

/**
 * Generate information about the available boot images for the system
 * @param  {Object}     req
 * @param  {Object}     res
 */
var listBootImage = controller(function(req, res) {
    var identifier = req.swagger.params.identifier.value;
    var options = redfish.makeOptions(req, res, identifier);

    return redfish.get('redfish.1.0.0.rackhd.bootimage.json', options)
    .catch(function(error) {
        return redfish.handleError(error, res);
    });
});

/**
 * Perform the boot image installation on the specified system
 * @param  {Object}     req
 * @param  {Object}     res
 */
var doBootImage = controller(function(req,res) {
    var identifier = req.swagger.params.identifier.value;
    var options = redfish.makeOptions(req, res, identifier);
    var payload = req.swagger.params.payload.value;

    return schemaApi.validate(payload, 'RackHD.BootImage.json#/definitions/BootImage')
    .then(function validatePayload(result) {
        if(result.error) {
            throw new Error(result.error);
        }

        var graphOptions = {
            defaults: payload
        };

        if( payload.osName.indexOf('+KVM') !== -1)  {
            graphOptions.defaults.kvm = true;
        }

        var graphName = '';
        if( payload.osName.indexOf('CentOS') !== -1)  {
            graphName = 'Graph.InstallCentOS';
            graphOptions.defaults.osName = 'CentOS';
        } else if(payload.osName.indexOf('ESXi') !== -1) {
            graphName = 'Graph.InstallEsx';
            graphOptions.defaults.osName = 'Esx';
        } else if(payload.osName.indexOf('RHEL') !== -1) {
            graphName = 'Graph.InstallRHEL';
            graphOptions.defaults.osName = 'RHEL';
        } else {
            throw new Error('invalid osName');
        }

        return [ graphName, graphOptions ];
    }).spread(function launchTask(name, graphOptions) {
        return nodeApi.setNodeWorkflowById({ name: name, options: graphOptions }, identifier);
    }).then(function reportTask(data) {
        return {
            '@odata.id': options.basepath + '/TaskService/Tasks/' + data.instanceId
        };
    }).then(function(output) {
        res.setHeader('Location', output['@odata.id']);
        res.status(201).json(output);
    }).catch(function(error) {
        return redfish.handleError(error, res);
    });
});

module.exports = {
    listSystems: listSystems,
    getSystem: getSystem,
    listSystemProcessors: listSystemProcessors,
    getSystemProcessor: getSystemProcessor,
    listSimpleStorage: listSimpleStorage,
    getSimpleStorage: getSimpleStorage,
    listLogService: listLogService,
    getSelLogService: getSelLogService,
    listSelLogServiceEntries: listSelLogServiceEntries,
    getSelLogServiceEntry: getSelLogServiceEntry,
    listResetTypes: listResetTypes,
    doReset: doReset,
    listBootImage: listBootImage,
    doBootImage: doBootImage
};
