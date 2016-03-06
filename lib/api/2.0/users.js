// Copyright 2016, EMC Inc.

'use strict';

var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var _ = injector.get('_'); // jshint ignore:line
var configuration = injector.get('Services.Configuration');
var waterline = injector.get('Services.Waterline');
var Errors = injector.get('Errors');
var aclService = injector.get('Acl.Services');
var localUserException = configuration.get('enableLocalHostException', true);

var addUser = controller({success: 201}, function(req, res) {
    var userObj = _.pick(req.swagger.params.body.value, ['username', 'password', 'role']);
    userObj.role = userObj.role || 'ReadOnly';  //TODO: move to Constants when Role code is added

    return waterline.localusers.find({}).then(function(users) {
        if(!users.length && localUserException && res.locals.ipAddress === '127.0.0.1') {
            // Only when there are no users, and the remote is a local connection, and we 
            // permit it, then let them add the first user.
            return waterline.localusers.create(userObj)
            .then(function(user) {
                return [user, aclService.aclMethod('addUserRoles',
                    userObj.username,
                    userObj.role )];
            }).spread(function(user) {
                return _.pick(user, ['username', 'role']);
            });
        }

        if( !_.find(users, function(user) {
            return user.username === userObj.username;
        })) {
            if( req.isAuthenticated && req.isAuthenticated() ) {
                return waterline.localusers.create(userObj)
                .then(function(user) {
                    return [user, aclService.aclMethod('addUserRoles',
                        userObj.username,
                        userObj.role )];
                }).spread(function(user) {
                    return _.pick(user, ['username', 'role']);
                });
            }
        }

        throw new Errors.UnauthorizedError('Unauthorized');
    });
});

var modifyUser = controller(function(req) {
    var userObj = _.pick(req.swagger.params.body.value, ['username', 'password', 'role']);
    if(!req.isAuthenticated) {
        throw new Errors.UnauthorizedError('Unauthorized');
    }

    if(!req.isAuthenticated()) {
        throw new Errors.UnauthorizedError('Unauthorized');
    }

    if( (req.user === userObj.username && req.hasRole('ConfigureSelf')) ||
        req.hasRole('Administrator') || 
        req.hasRole('ConfigureUsers') )
    {
        return waterline.localusers.findOne({username: userObj.username})
        .then(function(user) {
            if(user.role !== userObj.role) {
                return aclService.aclMethod('removeUserRoles',
                    user.username,
                    user.role)
                .then(function() {
                    return user;
                });
            }
            return user;
        }).then(function() {
            return waterline.localusers.update({username: userObj.username}, userObj);
        }).then(function(user) {
            return [user, aclService.aclMethod('addUserRoles',
                user.username,
                user.role )];
        }).spread(function(user) {
            return _.pick(user, ['username', 'role']);
        });
    }

    throw new Errors.ForbiddenError('Forbidden');
});

module.exports = {
    addUser: addUser,
    modifyUser: modifyUser
};
