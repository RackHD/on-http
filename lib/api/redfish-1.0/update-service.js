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
var fwTypeKeywords = [
    "PSU",
    "iDRAC",
    "BIOS",
    "RAID",
    //Todo : RAID needs to be updated once RackHD has the redfish support for Storage
    // "@odata.type":"#StorageCollection.StorageCollection" instead of
    // "@odata.type": "#SimpleStorage.v1_0_2.SimpleStorage" in http://<Rackhd_IP>/redfish/v1/Systems/593acc7e5aa5beed6f1f3082/SimpleStorage
    "Disk", //Todo : this needs to be updated once RackHD has the redfish support for Storage
    "Enclosure", //RAID device on the backplane
    "USC",
    "NIC",
    "Diagnostics",//Todo : needs to be tested once Dell and RackHD has the redfish support
    "DriverPack",//Todo : needs to be tested once Dell and RackHD has the redfish support
    "OSCollector",//Todo : needs to be tested once Dell and RackHD has the redfish support
    "CPLD",//Todo : needs to be tested once Dell and RackHD has the redfish support
    "PM",//Todo : needs to be tested once Dell and RackHD has the redfish support
    "BMC"
];

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

var getInventoryList = controller({success: 200}, function (req, res) {
    var options = redfish.makeOptions(req, res);

    return getVersions(options.url)
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

var getInventoryById = controller({success: 200}, function (req, res) {
    var identifier = req.swagger.params.identifier.value;
    var options = redfish.makeOptions(req, res, identifier);
    var pathsLookups = {
        "PSU": {
            end: "/Power#/PowerSupplies/",
            base: "/Chassis/",
            type: "complex" //This type of Redfish elements are not gettable. Navigation to the element happens in the json
        },
        "NIC": {
            end: "/EthernetInterfaces/",
            base: "/Systems/",
            type: "entity",
            enumerate: true //each member has its own odata.id
        },
        "iDRAC": {
            end: "",
            base: "/Managers/",
            type: "entity",
            enumerate: false
        },
        "BIOS": {
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
        },
        "Enclosure": {
            end: "",
            base: "/Chassis/",
            type: "entity",
            enumerate: false
        },
        "Disk": {
            end: "/SimpleStorage/",
            base: "/Systems/",
            type: "entity",
            enumerate: false
        },
        "RAID": {
            end: "/SimpleStorage/",
            base: "/Systems/",
            type: "entity",
            enumerate: false
        },
        "Diagnostics": {
            end: "",
            base: "/Systems/",
            type: "entity",
            enumerate: false
        },
        "DriverPack": {
            end: "",
            base: "/Systems/",
            type: "entity",
            enumerate: false
        },
        "OSCollector": {
            end: "",
            base: "/Systems/",
            type: "entity",
            enumerate: false
        },
        "CPLD": {
            end: "",
            base: "/Systems/",
            type: "entity",
            enumerate: false
        },
        "PM": {
            end: "",
            base: "/Systems/",
            type: "entity",
            enumerate: false
        },
        "BMC": {
            end: "",
            base: "/Managers/",
            type: "entity",
            enumerate: false
        }

    };
    options.elementInfo = pathsLookups[identifier.split('-')[0]];

    return getVersions(options.url)
        .then(function (allFwCollections) {
            var relatedItems = allFwCollections[identifier];
            if (options.elementInfo["base"] === "/Chassis/") {
                return updateChassisIds(relatedItems);
            }
            return relatedItems;
        })
        .then(function (relatedItems) {
            options.RelatedItems = relatedItems;
            return redfish.render('redfish.1.0.0.softwareinventory.json',
                'SoftwareInventory.json#/definitions/SoftwareInventory',
                options);
        })
        .catch(function (error) {
            return redfish.handleError(error, res);
        });
});

function getVersions(url) {
    var nodesProcessed = {};
    var allFwCollections = {};
    var matchComponent = '';
    url.indexOf("FirmwareInventory") !== -1 ? matchComponent = "FIRMWARE" : matchComponent = "APPLICATION";
    return new Promise.resolve()
        .then(function () {
            return getLatestCatalogs(nodesProcessed, ["racadm-firmware-list-catalog"]);
        })
        .then(function (catalogs) {
            return getFwCollections(fwTypeKeywords, catalogs);
        })
        .then(function (fwCollections) {
            var updatedCollections = fwCollections;
            _.mapKeys(fwCollections, function (value, key) {
                //NOTE:Ternary operatory is to include "BIOS" componentType under FIRMWARE. Also, checking if value has componentType key before updating the entry.
                if ((matchComponent === "APPLICATION" ? _.filter(value, _.matches({componentType: "APPLICATION"})).length === 0 : _.filter(value, _.matches({componentType: "APPLICATION"})).length !== 0 )
                    && _.findIndex(value, 'componentType') !== -1) {
                    delete updatedCollections[key];
                }
            });
            _.merge(allFwCollections, updatedCollections);
            return getLatestCatalogs(nodesProcessed, ["dmi", "ipmi-mc-info", "smart"]);
        })
        .then(function (catalogs) {
            return getFwCollections(fwTypeKeywords, catalogs);
        })
        .then(function (fwCollections) {
            return _.merge(allFwCollections, fwCollections);
        });
}

function getLatestCatalogs(processedNodes, sources) {
    var nodes = {};

    return waterline.catalogs.find({source: sources})
        .then(function (catalogs) {
            if (catalogs.length === 0) {
                return;
            }
            _.forEach(catalogs, function (catalog) {
                var nodeId = catalog["node"];
                if (processedNodes) {
                    if (nodeId in processedNodes) {
                        return;
                    }
                    processedNodes[nodeId] = "";
                }
                nodes[nodeId] = "done";
            });
            var nodeIds = Object.keys(nodes);
            var mostRecentCatalogs = [];
            return Promise.map(nodeIds, function (nodeId) {
                return Promise.map(sources, function (source) {
                    return waterline.catalogs.findMostRecent({
                        node: nodeId,
                        source: source
                    });
                })
                    .then(function (catalog) {
                        mostRecentCatalogs.push(catalog);
                        nodes[nodeId] = mostRecentCatalogs;
                        return nodes;
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
                if (source["source"] === "racadm-firmware-list-catalog") {
                    _.forEach(source["data"], function (element) {
                        prefix = element["FQDD"].split('.')[0];
                        if (_.includes(fwTypeKeywords, prefix)) {
                            FWType = prefix + '-' + element["currentVersion"];
                            entry = {
                                "FQDD": element["FQDD"],
                                "node": source["node"],
                                "componentType": element.componentType
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
    getInventoryList: getInventoryList,
    getInventoryById: getInventoryById
};
