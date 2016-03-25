// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var redfish = injector.get('Http.Api.Services.Redfish');
var controller = injector.get('Http.Services.Swagger').controller;
var Promise = injector.get('Promise');

var listRegistry = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);
    options.files = [{
      id: 'Base.1.0.0'
    }];
    return redfish.render('redfish.1.0.0.messageregistryfilecollection.1.0.0.json',
                          'MessageRegistryFileCollection.json#/definitions/' +
                          'MessageRegistryFileCollection',
                          options);
});

var getRegistryFile = controller(function(req, res) {
    var identifier = req.swagger.params.identifier.value;
    var options = redfish.makeOptions(req, res, identifier);
    return redfish.render('redfish.1.0.0.messageregistryfile.1.0.0.json',
                          'MessageRegistryFile.1.0.0.json#/definitions/MessageRegistryFile',
                          options);
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
