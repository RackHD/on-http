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
var fwTypeKeyords = [
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
    "Diagnostics",
    "DriverPack",
    "OSCollector",
    "CPLD",
    "PM"
];
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

var getFirmwareInventoryList = controller({success: 201}, function (req, res) {
    var options = redfish.makeOptions(req, res);

    return new Promise.resolve()
        .then(function(){
            return getLatestCatalogs();
        })
        .then(function(catalogs){
            return getFwCollections(fwTypeKeyords, catalogs);
        }).then(function (fwCollections) {
            options.fwItems = Object.keys(fwCollections);
            return redfish.render('redfish.1.0.0.softwareinventorycollection.json',
                'SoftwareInventoryCollection.json#/definitions/SoftwareInventoryCollection',
                options);
        }).catch(function (error) {
            return redfish.handleError(error, res);
        });
});

var getFirmwareInventoryById = controller({success: 201}, function (req, res) {
    var identifier = req.swagger.params.identifier.value;
    var options = redfish.makeOptions(req, res);
    var pathsLookups = {
        "PSU" :{
            end: "/Power#/PowerSupplies/",
            base: "/Chassis/",
            type: "complex" //This type of Redfish elements are not gettable. Navigation to the element happens in the json
        },
        "NIC": {
            end: "/EthernetInterfaces/",
            base: "/Systems/",
            type : "entity",
            enumerate : true //each member has its own odata.id
        },
        "iDRAC" : {
            end: "",
            base: "/Managers/",
            type : "entity",
            enumerate : false
        },
        "BIOS" : {
            end: "",
            base: "/Systems/",
            type : "entity",
            enumerate : false
        },
        "USC" : {
            end: "",
            base: "/Managers/",
            type : "entity",
            enumerate : false
        },
        "Enclosure" : {
            end: "",
            base: "/Chassis/",
            type : "entity",
            enumerate : false
        },
        "Disk" : {
            end: "/SimpleStorage/",
            base: "/Systems/",
            type : "entity",
            enumerate : false
        },
        "RAID" : {
            end: "/SimpleStorage/",
            base: "/Systems/",
            type : "entity",
            enumerate : false
        },
        "Diagnostics" : {
            end: "",
            base: "/Systems/",
            type : "entity",
            enumerate : false
        },
        "DriverPack" : {
            end: "",
            base: "/Systems/",
            type : "entity",
            enumerate : false
        },
        "OSCollector" : {
            end: "",
            base: "/Systems/",
            type : "entity",
            enumerate : false
        },
        "CPLD" : {
            end: "",
            base: "/Systems/",
            type : "entity",
            enumerate : false
        },
        "PM" : {
            end: "",
            base: "/Systems/",
            type : "entity",
            enumerate : false
        },

    };
    options.elementInfo= pathsLookups[identifier.split('-')[0]];

    return new Promise.resolve()
        .then(function(){
            return getLatestCatalogs();
        })
        .then(function(catalogs){
            return getFwCollections(fwTypeKeyords, catalogs);
        }).then(function (fwCollections) {
            var relatedItems = fwCollections[identifier];

            if (options.elementInfo["base"]=== "/Chassis/"){
                return updateChassisIds(relatedItems);
            }

            return relatedItems;
        }).
        then(function(relatedItems){
            options.RelatedItems = relatedItems;
            return redfish.render('redfish.1.0.0.softwareinventory.json',
                'SoftwareInventory.json#/definitions/SoftwareInventory',
                options);
        }).catch(function (error) {
            return redfish.handleError(error, res);
        });
});

function getLatestCatalogs() {
    //Return the most recent catalogs of all the nodes that
    //have a source: "racadm-firmware-list-catalog"
    var nodes = {};
    return waterline.catalogs.find({source: "racadm-firmware-list-catalog"})
        .then(function (catalogs) {
            _.forEach(catalogs, function (catalog) {
                nodes[catalog["node"]] = "done";
            });
            var nodeIds = Object.keys(nodes);
            return Promise.map(nodeIds, function (nodeId) {
                    return waterline.catalogs.findMostRecent({node: nodeId, source: "racadm-firmware-list-catalog"})
                        .then(function (catalog) {
                            nodes[nodeId] = catalog;
                            return nodes;
                        });
                })
                .spread(function (data) {
                    return data;
                });
        });
    
}

function getFwCollections(fwTypeKeyords, catalogs){
    //Return a collection of the unique FW versions and its related components
    var fwTypes = {};
    _.forEach(catalogs,function(catalog){
        _.forEach(catalog["data"],function(element){
            var prefix = element["FQDD"].split('.')[0];
            if ( _.includes(fwTypeKeyords, prefix)){
                var FWType = prefix + '-' + element["currentVersion"];
                var entry = {
                    "FQDD": element["FQDD"],
                    "node" : catalog["node"]
                };
                if(fwTypes[FWType] === undefined){
                    fwTypes[FWType] = [entry];
                }else{
                    fwTypes[FWType].push(entry);
                }
            }
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
        .then(function(data){
            return data;
        });
}

module.exports = {
    updateFirmware: updateFirmware,
    getFirmwareInventoryList: getFirmwareInventoryList,
    getFirmwareInventoryById: getFirmwareInventoryById
};
