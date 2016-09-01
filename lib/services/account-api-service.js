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
            var operator = {
                role: 'Operator',
                privileges: ['Login', 'ConfigureComponents', 'ConfigureSelf']
            };
            var admin = {
                role: 'Administrator',
                privileges: ['Read', 'Write', 'Login', 'ConfigureManager',
                             'ConfigureUsers', 'ConfigureComponents',
                             'ConfigureSelf']
            };
            var readOnly = {
                role: 'ReadOnly',
                privileges: ['Read', 'Login', 'ConfigureSelf']
            };
            return Promise.all([
                self.createRole(readOnly),
                self.createRole(operator),
                self.createRole(admin)
            ]).catch(function () {
                //mask error here
            });
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

    AccountApiService.prototype.createRole = function (newrole) {
        var self = this;
        var acl = this.acl;
        return Promise.try(function () {
            assert.string(newrole.role);
            return waterline.roles.create({
                role: newrole.role,
                privileges: newrole.privileges
            });
        })
        .then(function (entry) {
            return acl.addRoleParents(entry.role, entry.privileges);
        })
        .then(function () {
            return self.getRoleByName(newrole.role);
        })
        .catch(function(err) {
            if (err.message.match(/A record with that `role` already exists/)) {
                err = new Errors.BaseError('role already exists');
                err.status = 409;
            }
            throw err;
        });
    };

    AccountApiService.prototype.getRoleByName = function (name) {
        var self = this;
        return Promise.try(function () {
            assert.string(name);
            return waterline.roles.findOne({ role: name });
        })
        .then(function (roleFound) {
            if (!roleFound) {
                throw new Errors.NotFoundError();
            }
            return Promise.props({
                role: roleFound.role,
                privileges: self.aclMethod('_rolesParents', [roleFound.role])
            });
        });
    };

    AccountApiService.prototype.listRoles = function () {
        var self = this;
        return Promise.map(waterline.roles.find({}), function (role) {
            return Promise.props({
                role: role.role,
                privileges: self.aclMethod('_rolesParents', [role.role])
            });
        });
    };

    AccountApiService.prototype.removeRoleByName = function (name) {
        var acl = this.acl;
        return Promise.try(function () {
            assert.string(name);
        })
        .then(function () {
            return waterline.roles.findOne({ role: name });
        })
        .then(function (entry) {
            if (!entry) {
                throw new Errors.NotFoundError();
            }
            return Promise.all([
                acl.removeRoleParents(entry.role),
                waterline.roles.destroy({ role: name })
            ]);
        })
        .then(function () {
            return {
                role: name
            };
        });
    };

    AccountApiService.prototype.modifyRoleByRoleName = function (name, info) {
        var self = this;
        var acl = this.acl;
        return Promise.try(function () {
            assert.string(name);
            return waterline.roles.findOne({ role: name });
        })
        .then(function (entry) {
            if (!entry) {
                throw new Errors.NotFoundError();
            }
            return acl.removeRoleParents(entry.role);
        })
        .then(function () {
            return waterline.roles.update({ role: name }, info.privileges);
        })
        .then(function () {
            return acl.addRoleParents(name, info.privileges);
        })
        .then(function () {
            return self.getRoleByName(name);
        });
    };

    return new AccountApiService();
}
