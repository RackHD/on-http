// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../index.js').injector;
var _ = injector.get('_');    // jshint ignore:line
var Promise = injector.get('Promise');    // jshint ignore:line
var debug = require('debug')('swagger:authz');
var Error = injector.get('Errors'); // jshint ignore:line

function loadSwagger(authz, swaggerDef) {
    var promises = [];
    var methods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch'];
    _.forOwn(swaggerDef.paths, function(value, resourceName) {
        _.forEach(methods, function(method) {
            if(_.has(value, method) && _.has(value[method], 'x-privileges')) {
                _.forEach(value[method]['x-privileges'], function(role) {
                    var resource = swaggerDef.basePath + resourceName;
                    debug('adding ACL: %s:%s:%s', role, resource, method);
                    promises.push( authz.aclMethod('allow', role, resource, method) );
                });
            }
        });
    });
    return Promise.all(promises);
}

var hasRole = function(role) {
    return _.includes(this.roles, role );
};

module.exports = function create(fittingDef, bagpipes) {
    injector = require('../../index.js').injector;
    var authz = injector.get('Http.Services.Api.Account');
    var swaggerNodeRunner = bagpipes.config.swaggerNodeRunner;
    var ready = loadSwagger(authz, swaggerNodeRunner.swagger);
    var basePath = swaggerNodeRunner.swagger.basePath;
    return function swagger_authn_authz(context, next) {    // jshint ignore:line
        if(context.request.user) {
            ready.then(function() {
                return authz.aclMethod('isAllowed',
                    context.request.user,
                    basePath + context.request.swagger.operation.pathObject.path,
                    context.request.method.toLowerCase());
            }).then(function(allowed) {
                if(!allowed) {
                    return context.response.status(403).json({message: "Forbidden"});
                } else {
                    authz.aclMethod('userRoles', context.request.user)
                    .then(function(roles) {
                        return authz.aclMethod('_allRoles', roles);
                    }).then(function(allRoles) {
                        context.request.roles = allRoles;
                        context.request.hasRole = hasRole;
                        next();
                    });
                }
            })
            .catch(function(err) {
                next(err);
            });
        } else {
            debug('skipping authz, unknown authn');
            next();
        }
    };
};
