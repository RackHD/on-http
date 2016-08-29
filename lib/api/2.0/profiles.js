// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var profilesApiService = injector.get('Http.Services.Api.Profiles');
var profiles = injector.get('Profiles');

// GET /api/2.0/profiles/metadata
var profilesGetMetadata = controller(function() {
    return profiles.getAll();
});

// GET /api/2.0/profiles/metadata/:name
var profilesGetMetadataByName = controller(function (req) {
    return profiles.getName(req.swagger.params.name.value, req.swagger.query.scope);
});

// GET /api/2.0/profiles/library/:name
var profilesGetLibByName  = controller(function(req) {
    return profiles.get(req.swagger.params.name.value, req.swagger.query.scope)
    .then(function(profiles) {
        return profiles.contents;
    });
});

// PUT /api/2.0/profiles/library/:name
var profilesPutLibByName  = controller({success: 201}, function(req) {
    return profiles.put(req.swagger.params.name.value, req, req.swagger.query.scope);
});

// GET /api/2.0/profiles
var profilesGet = controller(function (req, res) {
    return profilesApiService.getProfiles(req, req.swagger.query, res)
        .then(function (render) {
            return profilesApiService.renderProfile(render, req, res);
        });
});

// GET /api/2.0/profiles/switch/:vendor
var profilesGetSwitchVendor = controller(function(req, res) {
    return profilesApiService.getProfilesSwitchVendor(
        req.connection._peername.address, req.swagger.params.vendor.value)
        .then (function(render) {
            return profilesApiService.renderProfile(render, req, res);
        });
});

// POST /api/2.0/profiles/switch/error/
var profilesPostSwitchError = controller({success: 201}, function(req) {
    return profilesApiService.postProfilesSwitchError(req.body);
});

module.exports = {
    profilesGetMetadata: profilesGetMetadata,
    profilesGetMetadataByName: profilesGetMetadataByName,
    profilesGetLibByName: profilesGetLibByName,
    profilesPutLibByName: profilesPutLibByName,
    profilesGet: profilesGet,
    profilesGetSwitchVendor: profilesGetSwitchVendor,
    profilesPostSwitchError: profilesPostSwitchError
};
