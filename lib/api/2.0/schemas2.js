// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var schemaApiService = injector.get('Http.Api.Services.Schema');
var nameSpace = '/api/2.0/schemas/';
var Errors = injector.get('Errors');
var taskOptionValidator = injector.get('TaskOption.Validator');

// GET /api/2.0/schemas
var schemasGet = controller(function() {
    return schemaApiService.getNamespace(nameSpace);
});

// GET /api/2.0/schemas/:identifier
var schemasIdGet = controller(function(req) {
    var schemaUid = nameSpace + req.swagger.params.identifier.value;
    var schema = schemaApiService.getSchema(schemaUid);
    if (schema) {
        return schema;
    }
    throw new Errors.NotFoundError(schemaUid + ' Not Found');
});

// GET /api/2.0/schemas/tasks
var taskSchemasGet = controller(function () {
    return taskOptionValidator.getAllSchemaNames({ includeNameSpace: false });
});

// GET /api/2.0/schemas/tasks/:identifier
var taskSchemasIdGet = controller(function (req) {
     var name = req.swagger.params.identifier.value;
     var resolveRef = req.swagger.params.resolveRef.value;
     var schema;
     if (resolveRef) {
        schema = taskOptionValidator.getSchemaResolved(name);
     }
     else {
        schema = taskOptionValidator.getSchema(name);
     }

     if (schema) {
         return schema;
     }

     throw new Errors.NotFoundError(name + ' Not Found');
});

module.exports = {
    schemasGet: schemasGet,
    schemasIdGet: schemasIdGet,
    taskSchemasGet: taskSchemasGet,
    taskSchemasIdGet: taskSchemasIdGet
};
