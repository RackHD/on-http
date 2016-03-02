// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var redfish = injector.get('Http.Api.Services.Redfish');
var Promise = injector.get('Promise'); // jshint ignore:line
var _ = injector.get('_');  // jshint ignore:line
var controller = injector.get('Http.Services.Swagger').controller;
var auth = injector.get('Auth.Services');
var uuid = injector.get('uuid');
var Errors = injector.get('Errors');

var getSessionService = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);
    return redfish.render('redfish.1.0.0.sessionservice.1.0.0.json', 
                 'SessionService.1.0.0.json#/definitions/SessionService',
                  options)
    .catch(function(error) {
        return redfish.handleError(error, res);
    });
});

var getSessions = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);
    options.sessions = auth.getRedfishSession();
    return redfish.render('redfish.1.0.0.sessioncollection.json', 
                 'SessionCollection.json#/definitions/SessionCollection',
                  options)
    .catch(function(error) {
        return redfish.handleError(error, res);
    });
});

var postSession = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);
    var payload = req.swagger.params.payload.value;
    return Promise.fromNode(auth.localStrategyAuth.bind(auth, payload.UserName, payload.Password))
        .then(function(user) {
            if(payload.UserName === user) {
                var id = uuid('v4');
                res.setHeader('X-Auth-Token', auth.addRedfishSession(user, id));
                options.entry = auth.getRedfishSession(id);
                return redfish.render('redfish.1.0.0.session.1.0.0.json', 
                    'Session.1.0.0.json#/definitions/Session',
                    options);
            }
            res.status(401).send("Unauthorized");
        });
});

var getSessionInfo = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);
    var identifier = req.swagger.params.identifier.value;
    var found = auth.getRedfishSession(identifier);
    return Promise.resolve(found).then(function(found) {
        if(found) {
            options.entry = found;
            return redfish.render('redfish.1.0.0.session.1.0.0.json', 
                'Session.1.0.0.json#/definitions/Session',
                options);
        } else {
            throw new Errors.NotFoundError('session identifier ' + identifier + ' was not found');
        }
    }).catch(function(error) {
        return redfish.handleError(error, res);
    });
});

var doLogoutSession = controller({success: 204}, function(req, res) {
    var identifier = req.swagger.params.identifier.value;
    var found = auth.getRedfishSession(identifier);
    return Promise.resolve(found).then(function(found) {
        if(found) {
            auth.delRedfishSession(identifier);
        } else {
            throw new Errors.NotFoundError('session identifier ' + identifier + ' was not found');
        }
    }).catch(function(error) {
        return redfish.handleError(error, res);
    });
});

module.exports = {
    getSessionService: getSessionService,
    getSessions: getSessions,
    postSession: postSession,
    getSessionInfo: getSessionInfo,
    doLogoutSession: doLogoutSession
};
