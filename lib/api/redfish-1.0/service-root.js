// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var redfish = injector.get('Http.Api.Services.Redfish');
var controller = injector.get('Http.Services.Swagger').controller;

var getServiceRoot = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);
    var systemUuid = injector.get('SystemUuid');
    return systemUuid.getUuid()
    .then(function(uuid) {
        options.uuid = uuid;
        return redfish.render('redfish.1.0.0.serviceroot.1.0.0.json', 
//                              'ServiceRoot.v1_1_1.json#/definitions/ServiceRoot',
                              '',
                              options);    
    })
    .catch(function(error) {
        return redfish.handleError(error, res);
    });
});

module.exports = {
    getServiceRoot: getServiceRoot
};
