// Copyright 2017, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var getOdata = controller(function() {
    var data = {
        "@odata.context": "/redfish/v1/$metadata",
        "value": [
            { "name": "Service", "kind": "Singleton", "url": "/redfish/v1/" },
            { "name": "Systems", "kind": "Singleton", "url": "/redfish/v1/Systems" },
            { "name": "Chassis", "kind": "Singleton", "url": "/redfish/v1/Chassis" },
            { "name": "Managers", "kind": "Singleton", "url": "/redfish/v1/Managers" },
            { "name": "UpdateService", "kind": "Singleton", "url": "/redfish/v1/UpdateService" },
            { "name": "TaskService", "kind": "Singleton", "url": "/redfish/v1/TaskService" },
            { "name": "SessionService", "kind": "Singleton", "url": "/redfish/v1/SessionService" },
            { "name": "AccountService", "kind": "Singleton", "url": "/redfish/v1/AccountService" },
            { "name": "EventService", "kind": "Singleton", "url": "/redfish/v1/EventService" },
            { "name": "Registries", "kind": "Singleton", "url": "/redfish/v1/Registries" }
        ]
    };

    return data;

});

module.exports = {
    getOdata: getOdata
};
