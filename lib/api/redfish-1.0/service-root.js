// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var redfish = injector.get('Http.Api.Services.Redfish');
var controller = injector.get('Http.Services.Swagger').controller;

var getServiceRoot = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);
    options.uuid = injector.get('uuid')('v4');
    return redfish.render('redfish.1.0.0.serviceroot.1.0.0.json', 
                          'ServiceRoot.1.0.0.json#/definitions/ServiceRoot',
                          options);
});

module.exports = {
    getServiceRoot: getServiceRoot
};
