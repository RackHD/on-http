// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var redfish = injector.get('Http.Api.Services.Redfish');
var controller = injector.get('Http.Services.Swagger').controller;
var Errors = injector.get('Errors');
var Promise = injector.get('Promise'); // jshint ignore:line
var _ = injector.get('_');  // jshint ignore:line

var registries = [{
    id: 'Base.1.0.0'
}];

var listRegistry = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);
    options.files = registries;
    return redfish.render('redfish.1.0.0.messageregistryfilecollection.1.0.0.json',
                          'MessageRegistryFileCollection.json#/definitions/' +
                          'MessageRegistryFileCollection',
                          options).catch(function(error) {
            return redfish.handleError(error, res);
        });
});

var getRegistryFile = controller(function(req, res) {
    var identifier = req.swagger.params.identifier.value;
    var options = redfish.makeOptions(req, res, identifier);

    return Promise.try(function() {
        if( _.indexOf(_.pluck(registries, 'id'), identifier) === -1) {
            throw new Errors.NotFoundError(identifier + ' was not found');
        }
        return redfish.render('redfish.1.0.0.messageregistryfile.1.0.0.json',
            'MessageRegistryFile.1.0.0.json#/definitions/MessageRegistryFile',
            options);
    })
    .catch(function(error) {
        return redfish.handleError(error, res);
    });
});

var getRegistryFileContents = controller(function(req, res) {
    var identifier = req.swagger.params.identifier.value;
    return redfish.getMessageRegistry(identifier)
        .catch(function(error) {
            return redfish.handleError(error, res);
        });
});

module.exports = {
    listRegistry: listRegistry,
    getRegistryFile: getRegistryFile,
    getRegistryFileContents: getRegistryFileContents
};
