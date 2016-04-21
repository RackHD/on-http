// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var redfish = injector.get('Http.Api.Services.Redfish');
var controller = injector.get('Http.Services.Swagger').controller;
var Promise = injector.get('Promise');    // jshint ignore:line
var _ = injector.get('_'); // jshint ignore:line
var Errors = injector.get('Errors');

var listSchemas = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);

    return redfish.getSchemas()
    .then(function(schemasObj){
        options.schemas = _.map(schemasObj, function(value) {
            var re = /\/v1\/(.+?)\.json$/;
            var match = re.exec(value);
            return match[1];
        }); 
        return redfish.render('redfish.1.0.0.jsonschemafilecollection.json',
            'JsonSchemaFileCollection.json#/definitions/JsonSchemaFileCollection',
            options);
    }).catch(function(error) {
        return redfish.handleError(error, res);
    });
});

var getSchema = controller(function(req, res){
    var identifier = req.swagger.params.identifier.value;
    var options = redfish.makeOptions(req, res, identifier);
    
    return redfish.getSchema(options.identifier)
    .then(function(schemaObj) {
        if(!schemaObj) {
            throw new Errors.NotFoundError(identifier + ' was not found');
        }
        options.identifier = identifier;
        return redfish.render('redfish.1.0.0.jsonschemafile.1.0.0.json',
            'JsonSchemaFile.1.0.0.json#/definitions/JsonSchemaFile',
            options);
    })
    .catch(function(error) {
        return redfish.handleError(error, res);
    });
});

var getSchemaContent = controller(function(req, res){
    var identifier = req.swagger.params.identifier.value;
    var options = redfish.makeOptions(req, res, identifier);

    return redfish.getSchema(options.identifier)
    .then(function(schemaObj) {
        if(!schemaObj) {
            throw new Errors.NotFoundError(identifier + ' was not found');
        }
        return schemaObj;
    }).catch(function(error) {
        return redfish.handleError(error, res);
    });
});

module.exports = {
    listSchemas: listSchemas,
    getSchema: getSchema,
    getSchemaContent: getSchemaContent,
};
