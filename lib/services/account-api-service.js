// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di'),
    nodeAcl = require( 'acl' );

module.exports = accountApiServiceFactory;
di.annotate(accountApiServiceFactory, new di.Provide('Http.Services.Api.Account'));
di.annotate(accountApiServiceFactory,
    new di.Inject(
        'Services.Waterline',
        'Errors',
        'Logger',
        '_',
        'Promise',
        'Constants',
        'Services.Configuration',
        'Assert'
    )
);
function accountApiServiceFactory(
    waterline,
    Errors,
    Logger,
    _,
    Promise,
    Constants,
    configuration,
    assert
) {
    var logger = Logger.initialize(accountApiServiceFactory);

    function AccountApiService() {
        this.acl = new nodeAcl(new nodeAcl.memoryBackend());  // jshint ignore:line
    }

    AccountApiService.prototype.start = function() {
        var acl = this.acl;
        var self = this;
        var endpoints = configuration.get('httpEndpoints', []);
        var authEnabled = _(endpoints).filter(function(endpoint) {
            return endpoint.authEnabled === true;
        }).compact().value();

        // Only initialize the service if an endpoint has enabled authn
        if(_.isEmpty(authEnabled)) {
            return;
        }

        return Promise.join( self.listUsers(), waterline.roles.find({}), function(users, roles) {
            var promises = _.map(users, function(user) {
                    return acl.addUserRoles(user.username, user.role);
                });
            var rolePromises = _.map(roles, function(roles) {
                    return acl.addRoleParents(roles.role, roles.privileges);
                });
            Array.prototype.push.apply(promises, rolePromises);
            return Promise.all(promises);
        }).then(function() {
            // Enforce a subset of hardcoded privileges:
            return Promise.all([
                // 2.0 API's fixed privileges
                acl.addRoleParents('Administrator', ['Read', 'Write']),
                acl.addRoleParents('ReadOnly', ['Read']),

                // Redfish 1.0 fixed privileges
                acl.addRoleParents('Administrator', ['Login','ConfigureManager','ConfigureUsers']),
                acl.addRoleParents('Administrator', ['ConfigureComponents','ConfigureSelf']),
                acl.addRoleParents('Operator', ['Login','ConfigureComponents','ConfigureSelf']),
                acl.addRoleParents('ReadOnly', ['Login', 'ConfigureSelf'])
            ]);
        });
    };

    AccountApiService.prototype.aclMethod = function(name) {
        var args = Array.prototype.slice.call(arguments, 1);
        return this.acl[name].apply(this.acl, args);
    };

    AccountApiService.prototype.listUsers = function() {
        var self = this;
        return Promise.map(waterline.localusers.find({}), function(user) {
            return Promise.props({
                id: user.id,
                username: user.username,
                role: user.role,
                privileges: self.aclMethod('_rolesParents', [user.role])
            });
        });
    };

    AccountApiService.prototype.getUserByName = function(username) {
        var self = this;
        return Promise.try(function() {
            assert.string(username);
            return waterline.localusers.findOne({username: username});
        })
        .then(function(user) {
            if(!user) {
                throw new Errors.NotFoundError();
            }
            return Promise.props({
                id: user.id,
                username: user.username,
                role: user.role,
                privileges: self.aclMethod('_rolesParents', [user.role])
            });
        });
    };

    AccountApiService.prototype.createUser = function(user) {
        var self = this;
        return Promise.try(function() {
            assert.string(user.username);
            return waterline.localusers.findOne({username: user.username});
        })
        .then(function(entry) {
            if(entry) {
                // TODO: Replace with HttpError after errors are refactored
                var err = new Errors.BaseError('the user already exists');
                err.status = 409;
                throw err;
            }
            return waterline.localusers.create({
                username: user.username,
                password: user.password,
                role: user.role
            });
        })
        .then(function(entry) {
            return self.aclMethod('addUserRoles', entry.username, entry.role);
        })
        .then(function() {
            return self.getUserByName(user.username);
        });
    };

    AccountApiService.prototype.modifyUserByName = function(name, info) {
        var self = this;
        return Promise.try(function() {
            assert.string(name);
            return waterline.localusers.findOne({username: name});
        })
        .then(function(entry) {
            if(!entry) {
                throw new Errors.NotFoundError();
            }
            if(info.role && info.role !== entry.role) {
                return [entry, self.aclMethod('removeUserRoles', entry.username, entry.role)];
            }
            return [ entry ];
        })
        .spread(function(entry) {
            return [entry, waterline.localusers.update({username: name}, info)];
        })
        .spread(function(entry) {
            if(info.role && info.role !== entry.role) {
                return [entry, self.aclMethod('addUserRoles', entry.username, info.role)];
            }
            return [entry];
        })
        .then(function() {
            return self.getUserByName(name);
        });
    };

    AccountApiService.prototype.removeUserByName = function(name) {
        var self = this;
        return Promise.try(function() {
            assert.string(name);
        })
        .then(function() {
            return waterline.localusers.findOne({username: name});
        })
        .then(function(entry) {
            if(!entry) {
                throw new Errors.NotFoundError();
            }
            return Promise.all([
                self.aclMethod('removeUserRoles', entry.username, entry.role),
                waterline.localusers.destroy({username: name})
            ]);
        })
        .then(function() {
            return {
                username: name
            };
        });
    };

    return new AccountApiService();
}
