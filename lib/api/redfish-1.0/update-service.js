// Copyright © 2017 Dell Inc. or its subsidiaries.  All Rights Reserved.

'use strict';

var xmlParser = require('xml2js').parseString;
var injector = require('../../../index.js').injector;
var redfish = injector.get('Http.Api.Services.Redfish');
var Promise = injector.get('Promise'); // jshint ignore:line
var _ = injector.get('_');  // jshint ignore:line
var controller = injector.get('Http.Services.Swagger').controller;
var Errors = injector.get('Errors');
var workflow = injector.get('Http.Services.Api.Workflows');
var waterline = injector.get('Services.Waterline');
var swPathsLookups = {
    //Todo : needs to be tested once Dell and RackHD has the redfish support
    "DriverPack": {
        end: "",
        base: "/Systems/",
        type: "entity",
        enumerate: false
    },
    //Todo : needs to be tested once Dell and RackHD has the redfish support
    "OSCollector": {
        end: "",
        base: "/Systems/",
        type: "entity",
        enumerate: false
    },
    //Todo : needs to be tested once Dell and RackHD has the redfish support
    "Diagnostics": {
        end: "",
        base: "/Systems/",
        type: "entity",
        enumerate: false
    },
    "USC": {
        end: "",
        base: "/Managers/",
        type: "entity",
        enumerate: false
    }
};
var fwPathsLookups = {
    "BIOS": {
        end: "",
        base: "/Systems/",
        type: "entity",
        enumerate: false
    },
    "iDRAC": {
        end: "",
        base: "/Managers/",
        type: "entity",
        enumerate: false
    },
    "BMC": {
        end: "",
        base: "/Managers/",
        type: "entity",
        enumerate: false
    },
    "PSU": {
        end: "/Power#/PowerSupplies/",
        base: "/Chassis/",
        type: "complex" //This type of Redfish elements are not gettable. Navigation to the element happens in the json
    },
    //Todo : RAID needs to be updated once RackHD has the redfish support for Storage
    // "@odata.type":"#StorageCollection.StorageCollection" instead of
    // "@odata.type": "#SimpleStorage.v1_0_2.SimpleStorage" in http://<Rackhd_IP>/redfish/v1/Systems/593acc7e5aa5beed6f1f3082/SimpleStorage
    "RAID": {
        end: "/SimpleStorage",
        base: "/Systems/",
        type: "entity",
        enumerate: false
    },
    //Todo : this needs to be updated once RackHD has the redfish support for Storage
    "Disk": {
        end: "/SimpleStorage",
        base: "/Systems/",
        type: "entity",
        enumerate: false
    },
    "Enclosure": {
        end: "",
        base: "/Chassis/",
        type: "entity",
        enumerate: false
    },
    "NIC": {
        end: "/EthernetInterfaces/",
        base: "/Systems/",
        type: "entity",
        enumerate: true //each member has its own odata.id
    },
    //Todo : needs to be tested once Dell and RackHD has the redfish support
    "CPLD": {
        end: "",
        base: "/Systems/",
        type: "entity",
        enumerate: false
    },
    //Todo : needs to be tested once Dell and RackHD has the redfish support
    "PM": {
        end: "",
        base: "/Systems/",
        type: "entity",
        enumerate: false
    }
};

var getUpdateService = controller({success: 200}, function (req, res) {
    var options = redfish.makeOptions(req, res);
    return redfish.render('redfish.1.0.0.updateservice.1.0.0.json',
        'UpdateService.v1_1_0.json#/definitions/UpdateService',
        options)
        .catch(function (error) {
            return redfish.handleError(error, res);
        });

});

var updateFirmware = controller({success: 201}, function (req, res) {
    var payload = req.swagger.params.payload.value;
    var targetNodeIds = payload.Targets;
    var errorList = [];
    var options = redfish.makeOptions(req, res, payload);

    // Run update firmware graph for each specified node id
    // If there are any errors, the entire request fails
    return Promise.map(
        targetNodeIds,
        function (targetNodeId) {
            return waterline.nodes.getNodeById(targetNodeId)
                .then(function (targetNode) {
                    if (!targetNode) {
                        throw new Errors.NotFoundError(
                            'Node not Found ' + targetNodeId);
                    }
                })
                .then(function () {
                    return workflow.createAndRunGraph(
                        {
                            name: 'Graph.Dell.Racadm.Update.Firmware',
                            options: {
                                defaults: {
                                    serverUsername: '',
                                    serverPassword: '',
                                    serverFilePath: payload.ImageURI
                                }
                            }
                        },
                        targetNodeId
                    );
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
        })
        .then(function () {
            if (errorList.length > 0) {
                throw new Error('One or more errors occured: ' + errorList);
            }
        }).catch(function (error) {
            var status = 400;
            return redfish.handleError(error, res, undefined, status);
        });
});

var getSoftwareInventoryList = controller({success: 200}, function (req, res) {
    var options = redfish.makeOptions(req, res);
    var matchComponent = "APAC";
    var keyMatch = Object.keys(swPathsLookups);
    return getVersions(options.url, keyMatch, matchComponent)
        .then(function (allFwCollections) {
            options.fwItems = Object.keys(allFwCollections);
            return redfish.render('redfish.1.0.0.softwareinventorycollection.json',
                'SoftwareInventoryCollection.json#/definitions/SoftwareInventoryCollection',
                options);
        })
        .catch(function (error) {
            return redfish.handleError(error, res);
        });
});

var getFirmwareInventoryList = controller({success: 200}, function (req, res) {
    var options = redfish.makeOptions(req, res);
    var matchComponent = "FRMW";
    var keyMatch = Object.keys(fwPathsLookups);
    return getVersions(options.url, keyMatch, matchComponent)
        .then(function (allFwCollections) {
            options.fwItems = Object.keys(allFwCollections);
            return redfish.render('redfish.1.0.0.softwareinventorycollection.json',
                'SoftwareInventoryCollection.json#/definitions/SoftwareInventoryCollection',
                options);
        })
        .catch(function (error) {
            return redfish.handleError(error, res);
        });
});

function validateInventoryId(identifier, paths) {
    if (identifier.indexOf('-') !== -1) {
        var temp = identifier.split('-')[0];
        if (temp in paths) {
            return (paths[temp]);
        }
        else {
            throw new Errors.NotFoundError('Identifier not Found ' + identifier);
        }
    }
    else {
        throw new Errors.NotFoundError('Identifier not Found ' + identifier);
    }
}

function getSoftFwInventory(options, identifier, pathsLookups, keyMatch, matchComponent) {
    return new Promise.resolve(validateInventoryId(identifier, pathsLookups))
        .then(function(elementInfo) {
            options.elementInfo = elementInfo;
            return getVersions(options.url, keyMatch, matchComponent);
        })
        .then(function (allFwCollections) {
            if (typeof allFwCollections[identifier] !== 'undefined') {
                var relatedItems = allFwCollections[identifier];
                if (options.elementInfo["base"] === "/Chassis/") {
                    return updateChassisIds(relatedItems);
                }
                return relatedItems;
            } else {
                throw new Errors.NotFoundError('Identifier not Found ' + identifier);
            }
        })
        .then(function (relatedItems) {
            options.RelatedItems = relatedItems;
            return redfish.render('redfish.1.0.0.softwareinventory.json',
                'SoftwareInventory.json#/definitions/SoftwareInventory',
                options);
        });
}

var getFirmwareInventoryById = controller({success: 200}, function (req, res) {
    var identifier = req.swagger.params.identifier.value;
    var options = redfish.makeOptions(req, res, identifier);
    var matchComponent = "FRMW";
    var keyMatch = Object.keys(fwPathsLookups);
    return getSoftFwInventory(options, identifier, fwPathsLookups, keyMatch, matchComponent);
});

var getSoftwareInventoryById = controller({success: 200}, function (req, res) {
    var identifier = req.swagger.params.identifier.value;
    var options = redfish.makeOptions(req, res, identifier);
    var matchComponent = "APAC";
    var keyMatch = Object.keys(swPathsLookups);
    return getSoftFwInventory(options, identifier, swPathsLookups, keyMatch, matchComponent);
});

function getVersions(url, keyMatch, matchComponent) {
    var allFwCollections = {};
    return new Promise.resolve()
        .then(function () {
            return getLatestCatalogs(["software", "dmi", "ipmi-mc-info", "smart"]);
        })
        .then(function (catalogs) {
            return getFwCollections(keyMatch, catalogs);
        })
        .then(function (fwCollections) {
            var updatedCollections = fwCollections;
            _.mapKeys(fwCollections, function (value, key) {
                //NOTE:Ternary operatory is to include "BIOS" componentType under FIRMWARE. Also, checking if value has componentType key before updating the entry.
                if ((matchComponent === "APAC" ? _.filter(value, _.matches({componentType: "APAC"})).length === 0 : _.filter(value, _.matches({componentType: "APAC"})).length !== 0 )
                    && _.findIndex(value, 'componentType') !== -1) {
                    delete updatedCollections[key];
                }
            });
            _.merge(allFwCollections, updatedCollections);
            return allFwCollections;
        });
}

function getLatestCatalogs(sources) {
    var nodelist = {};
    return waterline.nodes.find({type: 'compute'})
    .then(function (nodes) {
        return Promise.map(nodes, function (node) {
            var mostRecentCatalogs = [];
            return Promise.map(sources, function (source) {
                return waterline.catalogs.findLatestCatalogOfSource(node.id, source);
            })
            .then(function (catalog) {
                var catalogs = catalog.filter(function(item){
                                              return typeof item !== "undefined"; });
                mostRecentCatalogs.push(catalogs);
                nodelist[node.id] = mostRecentCatalogs;
                return nodelist;
            });
         })
         .spread(function (data) {
             return data;
         });
    });
}


function getFwCollections(fwTypeKeywords, catalogs) {
    //Return a collection of the unique FW versions and its related components
    var fwTypes = {};
    _.forEach(catalogs, function (catalog) {
        _.forEach(catalog, function (sources) {
            _.forEach(sources, function (source) {
                var prefix, FWType, entry, element;
                if (source["source"] === "software") {
                    _.forEach(source["data"], function (element) {
                        var FQDD = '';
                        var fqddString = element["any"][0];
                        if(!fqddString){
                            return;
                        }
                        xmlParser(fqddString, function (err, result) {
                            if(err){
                                return;
                            }else{
                                FQDD = result['n1:FQDD']._;
                            }
                        });
                        prefix = FQDD.split('.')[0];
                        if (_.includes(fwTypeKeywords, prefix)) {
                            FWType = prefix + '-' + element["versionString"].value;
                            entry = {
                                "FQDD": FQDD,
                                "node": source["node"],
                                "componentType": element.componentType.value
                            };
                            if (fwTypes[FWType] === undefined) {
                                fwTypes[FWType] = [entry];
                            } else {
                                fwTypes[FWType].push(entry);
                            }
                        }
                    });
                } else if (source["source"] === "dmi") {
                    if (source["data"]["BIOS Information"]) {
                        prefix = "BIOS";
                        element = source["data"]["BIOS Information"];
                        if (_.includes(fwTypeKeywords, prefix)) {
                            FWType = prefix + '-' + element["Version"];
                            entry = {
                                "Version": element["BIOS Revision"],
                                "node": source["node"]
                            };
                            if (fwTypes[FWType] === undefined) {
                                fwTypes[FWType] = [entry];
                            } else {
                                fwTypes[FWType].push(entry);
                            }
                        }
                    }
                } else if (source["source"] === "ipmi-mc-info") {
                    prefix = "BMC";
                    element = source["data"];
                    if (_.includes(fwTypeKeywords, prefix)) {
                        FWType = prefix + '-' + element["Firmware Revision"];
                        entry = {
                            "Version": element["Firmware Revision"],
                            "node": source["node"]
                        };
                        if (fwTypes[FWType] === undefined) {
                            fwTypes[FWType] = [entry];
                        } else {
                            fwTypes[FWType].push(entry);
                        }
                    }
                } else if (source["source"] === "smart") {
                    prefix = "Disk";
                    element = source["data"][0]["SMART"]["Identity"];
                    if (_.includes(fwTypeKeywords, prefix)) {
                        FWType = prefix + '-' + element["Firmware Version"];
                        entry = {
                            "Version": element["Firmware Version"],
                            "node": source["node"]
                        };
                        if (fwTypes[FWType] === undefined) {
                            fwTypes[FWType] = [entry];
                        } else {
                            fwTypes[FWType].push(entry);
                        }
                    }
                }
            });
        });
    });
    return fwTypes;
}

function updateChassisIds(elements) {
    //Takes a "compute" nodeID and return "enclosure" node ID
    return Promise.map(elements, function (element) {
        return waterline.nodes.findByIdentifier(element["node"])
            .then(function (node) {
                var chassisId = node.relations[0].targets[0];
                element.chassisId = chassisId;
                return element;
            });
    })
        .then(function (data) {
            return data;
        });
}

module.exports = {
    getUpdateService: getUpdateService,
    updateFirmware: updateFirmware,
    getSoftwareInventoryList: getSoftwareInventoryList,
    getFirmwareInventoryList: getFirmwareInventoryList,
    getSoftwareInventoryById: getSoftwareInventoryById,
    getFirmwareInventoryById: getFirmwareInventoryById
};
