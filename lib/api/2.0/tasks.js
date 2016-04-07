// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var tasksApiService = injector.get('Http.Services.Api.Tasks');
var taskProtocol = injector.get('Protocol.Task');
var Errors = injector.get('Errors');
var presenter = injector.get('common-api-presenter');

var getBootstrap = controller( function (req, res) {
    return tasksApiService.getBootstrap(req, res, req.swagger.params.macAddress.value);
});

var getTasksById = controller( {send204OnEmpty:true}, function (req){
    return tasksApiService.getTasks(req.swagger.params.identifier.value)
    .catch(function (err) {
        if (err.name === 'NoActiveTaskError') {
            //Return with no data, this will cause a 204 to be sent
            return;
        }
        // throw a NotFoundError
        throw new Errors.NotFoundError('Not Found');
    });
});

var postTaskById = controller( {success: 201}, function (req){
    return taskProtocol.respondCommands(
        req.swagger.params.identifier.value,
        req.swagger.params.body.raw);
});

module.exports = {
    getBootstrap: getBootstrap,
    getTasksById: getTasksById,
    postTaskById: postTaskById
};