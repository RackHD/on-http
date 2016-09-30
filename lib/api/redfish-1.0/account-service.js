// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var redfish = injector.get('Http.Api.Services.Redfish');
var Promise = injector.get('Promise'); // jshint ignore:line
var _ = injector.get('_');  // jshint ignore:line
var controller = injector.get('Http.Services.Swagger').controller;
var accountService = injector.get('Http.Services.Api.Account');
var Errors = injector.get('Errors');
var assert = injector.get('Assert');
var configuration = injector.get('Services.Configuration');

var getAccountService = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);
    return redfish.render('redfish.1.0.0.accountservice.1.0.0.json', 
                 'AccountService.1.0.0.json#/definitions/AccountService',
                  options)
    .catch(function(error) {
        return redfish.handleError(error, res);
    });
});

var getAccounts = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);
    return accountService.listUsers().then(function(users) {
        options.users = users;
    })
    .then(function() {
        return redfish.render('redfish.1.0.0.manageraccountcollection.json', 
                 'ManagerAccountCollection.json#/definitions/ManagerAccountCollection',
                  options);
    })
    .catch(function(error) {
        return redfish.handleError(error, res);
    });
});

var getAccount = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);
    var name = req.swagger.params.name.value;
    return accountService.getUserByName(name)
    .then(function(user) {
        if(!user) {
            throw new Errors.NotFoundError();
        }
        options.user = user;
        return redfish.render('redfish.1.0.0.manageraccount.1.0.0.json', 
                 'ManagerAccount.1.0.0.json#/definitions/ManagerAccount',
                  options);
    })
    .catch(function(error) {
        return redfish.handleError(error, res);
    });
});

var createAccount = controller({success: 201}, function(req, res) {
    var options = redfish.makeOptions(req, res);
    var payload = req.swagger.params.payload.value;
    var localUserException = configuration.get('enableLocalHostException', true);

    return Promise.try(function() {
        assert.string(payload.UserName);
        assert.string(payload.Password);
        assert.string(payload.RoleId);
        return accountService.listUsers();
    })
    .then(function(users) {
        if(!users.length && localUserException && res.locals.ipAddress === '127.0.0.1') {
            // Only when there are no users, and the remote is a local connection, and we 
            // permit it, then let them add the first user.
            return accountService.createUser({ 
                username: payload.UserName,
                password: payload.Password,
                role: payload.RoleId
            });
        }

        if( !_.find(users, function(user) {
            return user.username === payload.UserName;
        })) {
            if( req.isAuthenticated && req.isAuthenticated() ) {
                return accountService.createUser({ 
                    username: payload.UserName,
                    password: payload.Password,
                    role: payload.RoleId
                });
            }
        }
        throw new Errors.UnauthorizedError('Unauthorized');
    })
    .then(function() {
        return accountService.getUserByName(payload.UserName);
    })
    .then(function(user) {
        if(!user) {
            throw new Errors.NotFoundError();
        }
        options.user = user;
        return redfish.render('redfish.1.0.0.manageraccount.1.0.0.json', 
                 'ManagerAccount.1.0.0.json#/definitions/ManagerAccount',
                  options)
        .then(function(data) {
            res.location('/redfish/v1/AccountService/Accounts/' + user.username);
            return data;
        });
    })
    .catch(function(error) {
        return redfish.handleError(error, res);
    });
});

var modifyAccount = controller({success: 202}, function(req, res) {
    var options = redfish.makeOptions(req, res);
    var name = req.swagger.params.name.value;
    var payload = req.swagger.params.payload.value;
    var configureUsersAllows = ['Password', 'RoleId'];
    var configureSelfAllows = ['Password'];

    return Promise.try(function() {
        if(!req.isAuthenticated || !req.isAuthenticated()) {
            throw new Errors.UnauthorizedError('Unauthorized');
        }
        return accountService.getUserByName(name);
    })
    .then(function(entry) {
        if(!entry) {
            throw new Errors.NotFoundError();
        }

        var patch = {
            password: payload.Password,
            role: payload.RoleId
        };

        if( req.hasRole('Administrator') || req.hasRole('ConfigureUsers')) {
            if( Object.keys(_.omit(payload, configureUsersAllows)).length !== 0 ) {
                throw new Errors.BadRequestError('Bad Request');
            }
            return accountService.modifyUserByName(name, patch);
        } else if(req.user === entry.username && req.hasRole('ConfigureSelf')) {
            if( Object.keys(_.omit(payload, configureSelfAllows)).length !== 0 ) {
                throw new Errors.BadRequestError('Bad Request');
            }
            return accountService.modifyUserByName(name, _.pick(patch, 'password'));
        }
        throw new Errors.ForbiddenError('Forbidden');
    })
    .then(function(user) {
        options.user = user;
        return redfish.render('redfish.1.0.0.manageraccount.1.0.0.json', 
                 'ManagerAccount.1.0.0.json#/definitions/ManagerAccount',
                  options);
    })
    .catch(function(error) {
        return redfish.handleError(error, res);
    });
});

var removeAccount = controller({ send204OnEmpty: true }, function(req, res) {
    var name = req.swagger.params.name.value;
    return accountService.removeUserByName(name)
    .then(function() {
        return {};
    })
    .catch(function(error) {
        return redfish.handleError(error, res);
    });
});

module.exports = {
    getAccountService: getAccountService,
    getAccounts: getAccounts,
    getAccount: getAccount,
    createAccount: createAccount,
    modifyAccount: modifyAccount,
    removeAccount: removeAccount
};
