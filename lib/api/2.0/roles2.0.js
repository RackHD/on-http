// Copyright 2016, EMC Inc.

'use strict';

var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var _ = injector.get('_'); // jshint ignore:line
var accountService = injector.get('Http.Services.Api.Account');

var addRole = controller({ success: 201 }, function (req) {
    var roleObj = _.pick(req.swagger.params.body.value, ['role', 'privileges']);
    return accountService.createRole(roleObj);
});

var modifyRole = controller(function (req) {
    var name = req.swagger.params.name.value;
    var roleObj = _.pick(req.swagger.params.body.value, ['privileges']);
    return accountService.modifyRoleByRoleName(name, roleObj);
});

var listRoles = controller(function () {
    return accountService.listRoles();
});

var getRole = controller(function (req) {
    var name = req.swagger.params.name.value;
    return accountService.getRoleByName(name);
});

var removeRole = controller({ success: 204 }, function (req) {
    var name = req.swagger.params.name.value;
    return accountService.removeRoleByName(name);
});

module.exports = {
    addRole: addRole,
    modifyRole: modifyRole,
    listRoles: listRoles,
    getRole: getRole,
    removeRole: removeRole
};
