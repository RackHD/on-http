// Copyright 2016, EMC, Inc.

'use strict';

var injector = (typeof helper !== 'undefined') ? helper.injector : require('../../../index.js').injector;
var redfish = injector.get('Http.Api.Services.Redfish');
var waterline = injector.get('Services.Waterline');
var taskProtocol = injector.get('Protocol.Task');
var Errors = injector.get('Errors');
var Promise = injector.get('Promise');
var _ = injector.get('_');

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
    getSelLogServiceEntry: getSelLogServiceEntry
};

var dataFactory = function(identifier, dataName) {
    switch(dataName)  {
        case 'ohai':
        case 'dmi':
        case 'smart':
            return waterline.nodes.needByIdentifier(identifier)
            .then(function(node) {
                return waterline.catalogs.findLatestCatalogOfSource(
                        node.id, dataName
                    ).then(function (catalogs) {
                        if (_.isEmpty(catalogs)) {
                            throw new Errors.NotFoundError(
                                'No Catalogs Found for Source (' + dataName + ').'
                            );
                        }
                        return catalogs;
                    });
            });

        case 'chassis':
            return waterline.nodes.needByIdentifier(identifier)
            .then(function(node) {
                return _.filter(node.relations, function(relation) {
                    return relation.relationType === 'enclosedBy';
                }).map(function(relation) {
                    return relation.targets[0];
                });
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
            }).catch(function() {
                return { power: "Unknown", uid: "Unknown"};
            });
        
        case 'selInfoData':
            return waterline.workitems.findPollers({node: identifier})
            .filter(function(poller) {
                return poller.config.command === 'selInformation';
            }).spread(function(poller) {
                return taskProtocol.requestPollerCache(poller.id, { latestOnly: true });
            }).then(function(data) {
                return data[0].selInformation;
            });

        case 'selData':
            return waterline.workitems.findPollers({node: identifier})
            .filter(function(poller) {
                return poller.config.command === 'sel';
            }).spread(function(poller) {
                return taskProtocol.requestPollerCache(poller.id, { latestOnly: true });
            }).then(function(data) {
                return data[0].sel;
            });
    }
};

function listSystems(req, res) {
    var options = {};
    options.basepath = req.swagger.operation.api.basePath;
    options.templateScope = ['global'];
    options.url = req.url;

    waterline.nodes.find({type: 'compute'}).then(function(nodes) {
        options.nodes = nodes;
        return redfish.render('redfish.1.0.0.computersystemcollection.json', 
                            'ComputerSystemCollection.json#/definitions/ComputerSystemCollection',
                            options);
    }).then(function(output) {
        res.status(200).json(output);
    })
    .catch(function(error) {
        res.status(500).json(error);
    });
}

function getSystem(req, res) {
    var identifier = req.swagger.params.identifier.value;
    var options = {};
    options.basepath = req.swagger.operation.api.basePath;
    options.systemType = 'Physical';
    options.templateScope = ['global'];
    options.url = req.url;
    options.identifier = identifier;

    Promise.all([ dataFactory(identifier, 'ohai'),
                   dataFactory(identifier, 'dmi'),
                   dataFactory(identifier, 'chassis'),
                   dataFactory(identifier, 'chassisData')
                 ])
        .spread(function(ohai, dmi, chassis, chassisData) {
            options.ohai = ohai;
            options.dmi = dmi;
            options.chassis = chassis;
            options.chassisData = chassisData || 'Unknown';
            return redfish.render('redfish.1.0.0.computersystem.1.0.0.json', 
                            'ComputerSystem.1.0.0.json#/definitions/ComputerSystem',
                            options);
    }).then(function(output) {
        res.status(200).json(output);
    })
    .catch(function(error) {
        res.status(500).json(error);
    });
}

function listSystemProcessors(req, res)  {
    var identifier = req.swagger.params.identifier.value;

    var options = {};
    options.basepath = req.swagger.operation.api.basePath;
    options.templateScope = ['global'];
    options.url = req.url;
    options.identifier = identifier;

    Promise.all([ dataFactory(identifier, 'dmi') ])
        .spread(function(dmi) {
            options.dmi = dmi;
            return redfish.render('redfish.1.0.0.processorcollection.json', 
                            'ProcessorCollection.json#/definitions/ProcessorCollection',
                            options);
    }).then(function(output) {
        res.status(200).json(output);
    })
    .catch(function(error) {
        res.status(500).json(error);
    });
}

function getSystemProcessor(req, res)  {
    var identifier = req.swagger.params.identifier.value;
    var socket = req.swagger.params.socket.value;

    var options = {};
    options.basepath = req.swagger.operation.api.basePath;
    options.templateScope = ['global'];
    options.url = req.url;
    options.identifier = identifier;
    options.socketId = socket;

    Promise.all([ dataFactory(identifier, 'dmi'),
                  dataFactory(identifier, 'ohai') ])
        .spread(function(dmi, ohai) {
            options.dmi = dmi;
            options.ohai = ohai;
            return redfish.render('redfish.1.0.0.processor.1.0.0.json', 
                            'Processor.1.0.0.json#/definitions/Processor',
                            options);
    }).then(function(output) {
        res.status(200).json(output);
    })
    .catch(function(error) {
        res.status(500).json(error);
    });
}

function listSimpleStorage(req, res)  {
    var identifier = req.swagger.params.identifier.value;

    var options = {};
    options.basepath = req.swagger.operation.api.basePath;
    options.templateScope = ['global'];
    options.url = req.url;
    options.identifier = identifier;

    Promise.all([ dataFactory(identifier, 'dmi'),
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
    }).then(function(output) {
        res.status(200).json(output);
    })
    .catch(function(error) {
        res.status(500).json(error);
    });
}

function getSimpleStorage(req, res)  {
    var identifier = req.swagger.params.identifier.value;
    var index = req.swagger.params.index.value;

    var options = {};
    options.basepath = req.swagger.operation.api.basePath;
    options.templateScope = ['global'];
    options.url = req.url;
    options.identifier = identifier;
    options.index = index;

    Promise.all([ dataFactory(identifier, 'dmi'),
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
    }).then(function(output) {
        res.status(200).json(output);
    })
    .catch(function(error) {
        res.status(500).json(error);
    });
}

function listLogService(req, res)  {
    var identifier = req.swagger.params.identifier.value;

    var options = {};
    options.basepath = req.swagger.operation.api.basePath;
    options.templateScope = ['global'];
    options.url = req.url;
    options.identifier = identifier;

    options.logSource = ['sel'];
    redfish.render('redfish.1.0.0.logservicecollection.json', 
                 'LogServiceCollection.json#/definitions/LogServiceCollection',
                  options)
    .then(function(output) {
        res.status(200).json(output);
    })
    .catch(function(error) {
        res.status(500).json(error);
    });
}

function getSelLogService(req, res)  {
    var identifier = req.swagger.params.identifier.value;

    var options = {};
    options.basepath = req.swagger.operation.api.basePath;
    options.templateScope = ['global'];
    options.url = req.url;
    options.identifier = identifier;
    options.type = 'sel';
    options.description = 'IPMI System Event Log';
    options.name = 'ipmi-sel-information';
    options.log = {};

    Promise.all([ dataFactory(identifier, 'selInfoData') ])
        .spread(function(sel) {
            options.log.size = sel['# of Alloc Units'] || 0;
            options.log.policy = sel.Overflow && sel.Overflow === 'false' ? 
                'WrapsWhenFull' : 
                'NeverOverWrites';
            options.log.lastWriteDate = sel['Last Add Time'] || 'Unknown';
            return redfish.render('redfish.1.0.0.logservice.1.0.0.json', 
                            'LogService.1.0.0.json#/definitions/LogService',
                            options);
    }).then(function(output) {
        res.status(200).json(output);
    })
    .catch(function(error) {
        res.status(500).json(error);
    });
}

function listSelLogServiceEntries(req, res)  {
    var identifier = req.swagger.params.identifier.value;

    var options = {};
    options.basepath = req.swagger.operation.api.basePath;
    options.templateScope = ['global'];
    options.url = req.url;
    options.identifier = identifier;
    options.type = 'SEL';

    Promise.all([ dataFactory(identifier, 'selData') ])
        .spread(function(selData) {
            options.logEntries = selData;
            return redfish.render('redfish.1.0.0.logentrycollection.json', 
                            'LogEntryCollection.json#/definitions/LogEntryCollection',
                            options);
    }).then(function(output) {
        res.status(200).json(output);
    })
    .catch(function(error) {
        res.status(500).json(error);
    });
}

function getSelLogServiceEntry(req, res)  {
    var identifier = req.swagger.params.identifier.value;
    var entryId = req.swagger.params.entryId.value;

    var options = {};
    options.basepath = req.swagger.operation.api.basePath;
    options.templateScope = ['global'];
    options.url = req.url;
    options.identifier = identifier;
    options.type = 'sel';
    options.description = 'IPMI System Event Log';
    options.name = 'ipmi-sel-information';
    options.log = {};

    Promise.all([ dataFactory(identifier, 'selData') ])
        .spread(function(selData) {
            options.entries = _.filter(selData, function(entry) {
                return entry.logId === entryId;
            });
            options.entry = options.entries[0];
            return redfish.render('redfish.1.0.0.logentry.1.0.0.json', 
                            'LogEntry.1.0.0.json#/definitions/LogEntry',
                            options);
    }).then(function(output) {
        res.status(200).json(output);
    })
    .catch(function(error) {
        res.status(500).json(error);
    });
}

