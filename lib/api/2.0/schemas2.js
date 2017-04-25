// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var schemaApiService = injector.get('Http.Api.Services.Schema');
var nameSpace = '/api/2.0/schemas/';
var Errors = injector.get('Errors');
var workflowApiService = injector.get('Http.Services.Api.Workflows');
var Task = injector.get('Task.Task');
var _ = injector.get('_');

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
    return workflowApiService.getTaskDefinitions()
    .then(function(tasks) {
        return tasks.map(function(task) {
            return task.injectableName;
        });
    });
});

// GET /api/2.0/schemas/tasks/:identifier
var taskSchemasIdGet = controller(function (req) {
    var name = req.swagger.params.identifier.value;
    return workflowApiService.getWorkflowsTasksByName(name)
    .then(function(taskDefinitions) {
        if (_.isEmpty(taskDefinitions)) {
            throw new Errors.NotFoundError(
                'Unable to find the task defintion with injectablenName ' + name);
        }
        return Task.getFullSchema(taskDefinitions[0]);
    });
});

module.exports = {
    schemasGet: schemasGet,
    schemasIdGet: schemasIdGet,
    taskSchemasGet: taskSchemasGet,
    taskSchemasIdGet: taskSchemasIdGet
};
