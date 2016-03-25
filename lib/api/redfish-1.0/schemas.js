// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var redfish = injector.get('Http.Api.Services.Redfish');
var controller = injector.get('Http.Services.Swagger').controller;
var Promise = injector.get('Promise');    // jshint ignore:line
var _ = injector.get('_'); // jshint ignore:line

var listSchemas = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);
    return Promise.props({
        schemasObj: redfish.getSchemas()
    }).then(function(data){
        _.forEach(data.schemasObj, function(value, idx){
            data.schemasObj[idx] = (value.split('/v1/'))[1];
            //removing the .json extension
            data.schemasObj[idx] = (data.schemasObj[idx].split('.json'))[0];
        });
        options.schemas = data.schemasObj;
        return options;
    }).then(function(){
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
    options.identifier = identifier;
    return redfish.render('redfish.1.0.0.jsonschemafile.1.0.0.json',
        'JsonSchemaFile.1.0.0.json#/definitions/JsonSchemaFile',
        options).catch(function(error) {
        return redfish.handleError(error, res);
    });

});
var getSchemaContent = controller(function(req, res){
    var identifier = req.swagger.params.identifier.value;
    var options = redfish.makeOptions(req, res, identifier);

    return Promise.resolve().then(function(){
        return redfish.getSchema(options.identifier);
    }).catch(function(error) {
        return redfish.handleError(error, res);
    });
});

module.exports = {
    listSchemas: listSchemas,
    getSchema: getSchema,
    getSchemaContent: getSchemaContent,
};
