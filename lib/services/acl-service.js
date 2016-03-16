// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di'),
    nodeAcl = require( 'acl' );

module.exports = aclServiceFactory;
di.annotate(aclServiceFactory, new di.Provide('Acl.Services'));
di.annotate(aclServiceFactory,
    new di.Inject(
        'Services.Configuration',
        'Promise',
        'Services.Waterline',
        '_'
    )
);

function aclServiceFactory(
    configuration,
    Promise,
    waterline,
    _
) {
    function AclService() {
        this.acl = new nodeAcl(new nodeAcl.memoryBackend());  // jshint ignore:line
    }

    AclService.prototype.start = function() {
        var acl = this.acl;
        var endpoints = configuration.get('httpEndpoints', []);
        var authEnabled = _(endpoints).filter(function(endpoint) {
            return endpoint.authEnabled === true;
        }).compact().value();

        // Only initialize the service if an endpoint has enabled authn
        if(_.isEmpty(authEnabled)) {
            return;
        }

        return Promise.all([
            waterline.localusers.find({}),
            waterline.roles.find({})
        ]).spread(function(users, roles) {
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

    AclService.prototype.aclMethod = function(name) {
        var args = Array.prototype.slice.call(arguments, 1);
        return this.acl[name].apply(this.acl, args);
    };

    return new AclService();
}
