// Copyright 2016, EMC Inc.

'use strict';

var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var _ = injector.get('_'); // jshint ignore:line
var configuration = injector.get('Services.Configuration');
var accountService = injector.get('Http.Services.Api.Account');
var Errors = injector.get('Errors');
var Promise = injector.get('Promise');
var assert = injector.get('Assert');

var addUser = controller({success: 201}, function(req, res) {
    var userObj = _.pick(req.swagger.params.body.value, ['username', 'password', 'role']);
    var localUserException = configuration.get('enableLocalHostException', true);
    userObj.role = userObj.role || 'ReadOnly';  //TODO: move to Constants when Role code is added

    return Promise.try(function() {
        assert.string(userObj.username);
        assert.string(userObj.password);
        assert.string(userObj.role);
        return accountService.listUsers();
    })
    .then(function(users) {
        if(!users.length && localUserException && res.locals.ipAddress === '127.0.0.1') {
            // Only when there are no users, and the remote is a local connection, and we 
            // permit it, then let them add the first user.
            return accountService.createUser(userObj)
            .then(function(user) {
                return _.pick(user, ['username', 'role']);
            });
        }

        if( !_.find(users, function(user) {
            return user.username === userObj.username;
        })) {
            if( req.isAuthenticated && req.isAuthenticated() ) {
                return accountService.createUser(userObj)
                .then(function(user) {
                    return _.pick(user, ['username', 'role']);
                });
            }
        }

        throw new Errors.UnauthorizedError('Unauthorized');
    });
});

var modifyUser = controller(function(req) {
    var name = req.swagger.params.name.value;
    var userObj = _.pick(req.swagger.params.body.value, ['password', 'role']);
    var configureUsersAllows = ['password', 'role'];
    var configureSelfAllows = ['password'];

    return Promise.try(function() {
        if(!req.isAuthenticated || !req.isAuthenticated()) {
            throw new Errors.UnauthorizedError('Unauthorized');
        }
        return accountService.getUserByName(name);
    })
    .then(function(entry) {
        if(!entry) {
            throw new Error.NotFoundError();
        }

        if(req.hasRole('Administrator') || req.hasRole('ConfigureUsers')) {
            if( Object.keys(_.omit(req.swagger.params.body.value, configureUsersAllows)).length !== 0 ) {
                throw new Errors.BadRequestError('Bad Request');
            }
            return accountService.modifyUserByName(name, userObj);
        } else if(req.user === entry.username && req.hasRole('ConfigureSelf')) {
            if( Object.keys(_.omit(req.swagger.params.body.value, configureSelfAllows)).length !== 0 ) {
                throw new Errors.BadRequestError('Bad Request');
            }
            return accountService.modifyUserByName(name, _.pick(userObj, 'password'));
        }
        throw new Errors.ForbiddenError('Forbidden');
    });
});

var listUsers = controller(function() {
    return accountService.listUsers();
});

var getUser = controller(function(req) {
    var name = req.swagger.params.name.value;
    return accountService.getUserByName(name);
});

var removeUser = controller({success: 204}, function(req) {
    var name = req.swagger.params.name.value;
    return accountService.removeUserByName(name);
});

module.exports = {
    addUser: addUser,
    modifyUser: modifyUser,
    listUsers: listUsers,
    getUser: getUser,
    removeUser: removeUser
};
