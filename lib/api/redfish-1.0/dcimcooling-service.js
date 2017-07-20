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

var listDCIMCooling = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);
    return waterline.nodes.find({type: 'compute'}).then(function(nodes) {
        options.nodes = nodes;
        return redfish.render('redfish.1.0.0.DCIMCoolingCollection.json',
            '',
            options);
    }).catch(function(error) {
        return redfish.handleError(error, res);
    });
});

/*
var getDCIMCoolingDefault = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);
    var typeEnum = [
        "Chiller",
        "CRAC",
        "CRAH",
        "CoolingTower",
        "AirHandlingUnit"];


});
*/

var listDCIMCoolingDefault = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);
    return Promise.map(waterline.nodes.find({type: 'cooling'}), function(node) {
        return waterline.nodes.getNodeById(node.id);
    })
        .then(function(nodes) {
            options.components = _.reduce(nodes, function(arr, val) {
                arr.push({id: val.id, name: val.name});
                return arr;
            }, []);
            return redfish.render('redfish.1.0.0.DCIMCooling.json',
                '',
                options);
        }).catch(function(error) {
            return redfish.handleError(error, res);
        });
});

var listDCIMCoolingDefaultChiller = controller(function(req, res) {
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
                '',
                options);
        }).catch(function(error) {
            return redfish.handleError(error, res);
        });
});

var listDCIMCoolingDefaultCRAC = controller(function(req, res) {
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
                '',
                options);
        }).catch(function(error) {
            return redfish.handleError(error, res);
        });
});

var listDCIMCoolingDefaultCRAH = controller(function(req, res) {
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
                '',
                options);
        }).catch(function(error) {
            return redfish.handleError(error, res);
        });
});

var listDCIMCoolingDefaultCoolingTower = controller(function(req, res) {
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
                '',
                options);
        }).catch(function(error) {
            return redfish.handleError(error, res);
        });
});

var listDCIMCoolingDefaultAirHandlingUnit = controller(function(req, res) {
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
                '',
                options);
        }).catch(function(error) {
            return redfish.handleError(error, res);
        });
});

module.exports = {
    listDCIMCooling: listDCIMCooling,
    //getDCIMCoolingDefault: getDCIMCoolingDefault,
    listDCIMCoolingDefault: listDCIMCoolingDefault,
    listDCIMCoolingDefaultChiller: listDCIMCoolingDefaultChiller,
    listDCIMCoolingDefaultCRAH: listDCIMCoolingDefaultCRAH,
    listDCIMCoolingDefaultCRAC: listDCIMCoolingDefaultCRAC,
    listDCIMCoolingDefaultCoolingTower: listDCIMCoolingDefaultCoolingTower,
    listDCIMCoolingDefaultAirHandlingUnit: listDCIMCoolingDefaultAirHandlingUnit
};
