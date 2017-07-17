// Copyright 2017, EMC, Inc.

'use strict';
var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var getRedfishProtocolVersion = controller(function() {
    var data = {
        "v1": "/redfish/v1/"
    };
    return data;

});

module.exports = {
    getRedfishProtocolVersion: getRedfishProtocolVersion
};

