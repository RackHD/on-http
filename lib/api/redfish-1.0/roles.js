// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var redfish = injector.get('Http.Api.Services.Redfish');
var controller = injector.get('Http.Services.Swagger').controller;
var Promise = injector.get('Promise');    // jshint ignore:line
var _ = injector.get('_'); // jshint ignore:line
var Errors = injector.get('Errors');

//The values of the roles below are required by the Redfish spec 1.0.0
//section 9.3.8
var rolesObj = {
    "Administrator":['Login', 'ConfigureManager', 'ConfigureUsers',
                     'ConfigureComponents', 'ConfigureSelf'],
    "Operator" : ['Login', 'ConfigureComponents', 'ConfigureSelf'],
    "ReadOnly" : ['Login', 'ConfigureSelf']
};

var listRoles = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);
    options.roles = _.keys(rolesObj);

    return Promise.try(function() {
        return redfish.render('redfish.1.0.0.rolecollection.json',
            'Role.json#/definitions/Role',
            options);
    })
    .catch(function(error) {
        return redfish.handleError(error, res);
    });
});

var getRole = controller(function(req, res){
    var identifier = req.swagger.params.identifier.value;
    var options = redfish.makeOptions(req, res, identifier);
    options.identifier = identifier;
    options.rolePrivileges = _.get(rolesObj, identifier);

    return Promise.try(function() {
        if(!_.has(rolesObj, identifier)) {
            throw new Errors.NotFoundError('role not found');
        }

        return redfish.render('redfish.1.0.0.role.1.0.0.json',
            'Role.1.0.0.json#/definitions/Role',
            options);
    })
    .catch(function(error) {
        return redfish.handleError(error, res);
    });
});

module.exports = {
    listRoles: listRoles,
    getRole: getRole,
};
