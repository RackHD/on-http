// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var redfish = injector.get('Http.Api.Services.Redfish');
var waterline = injector.get('Services.Waterline');
var Promise = injector.get('Promise'); // jshint ignore:line
var _ = injector.get('_');  // jshint ignore:line
var Constants = injector.get('Constants');
var moment = require('moment');
var controller = injector.get('Http.Services.Swagger').controller;

var dataFactory = function(identifier, dataName) {
    var statusMap = {};
    statusMap[Constants.Task.States.Pending] = 'Running';
    statusMap[Constants.Task.States.Running] = 'Running';
    statusMap[Constants.Task.States.Succeeded] = 'Completed';
    statusMap[Constants.Task.States.Cancelled] = 'Killed';
    statusMap[Constants.Task.States.Failed] = 'Exception';

    switch(dataName)  {
        case 'graphObjects':
            return Promise.map(waterline.graphobjects.find({}), function(graph) {
                return {
                    state: statusMap[graph._status],
                    id: graph.instanceId,
                    status: 'OK',
                    startTime: moment.utc(graph.createdAt).format(),
                    endTime: (Constants.Task.ActiveStates.indexOf(graph._status) === -1) ?
                        moment.utc(graph.updatedAt).format() :
                        '',
                    name: graph.name,
                    systemId: graph.node
                };
            });
    }
};

var taskServiceRoot = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);
    options.dateTime = moment.utc().format();
    options.systems = [];

    return Promise.all([ dataFactory('', 'graphObjects') ])
    .spread(function(graphs) {
        _.forEach(graphs, function(graph) {
            if (graph.systemId && -1 === options.systems.indexOf(graph.systemId))  {
                options.systems.push(graph.systemId);
            }
        });
        options.graphs = graphs;
        return redfish.render('redfish.1.0.0.taskservice.1.0.0.json',
                'TaskService.1.0.0.json#/definitions/TaskService',
                options);
    }).catch(function(error) {
        return redfish.handleError(error, res);
    });
});

var listTasks = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);
    options.dateTime = moment.utc().format();

    return Promise.all([ dataFactory('', 'graphObjects') ])
    .spread(function(graphs) {
        options.graphs = graphs;
        return redfish.render('redfish.1.0.0.taskcollection.json',
                'TaskCollection.json#/definitions/TaskCollection',
                options);
    }).catch(function(error) {
        return redfish.handleError(error, res);
    });
});

var getTask = controller(function(req, res) {
    var identifier = req.swagger.params.identifier.value;
    var options = redfish.makeOptions(req, res, identifier);

    return Promise.all([ dataFactory('', 'graphObjects') ])
    .spread(function(graphs) {
        options.graphs = _.filter(graphs, function(graph) {
            return graph.id === identifier;
        });
        options.graph = options.graphs[0];

        return redfish.render('redfish.1.0.0.task.1.0.0.json',
                'Task.1.0.0.json#/definitions/Task',
                options);
    }).catch(function(error) {
        return redfish.handleError(error, res);
    });
});

var getSystemTasks = controller(function(req, res) {
    var identifier = req.swagger.params.identifier.value;
    var options = redfish.makeOptions(req, res, identifier);

    return waterline.nodes.needByIdentifier(identifier)
    .then(function() {
        return Promise.all([ dataFactory('', 'graphObjects') ])
            .spread(function(graphs) {
                options.graphs = _.filter(graphs, function(graph) {
                    return graph.systemId === identifier;
                });
                return redfish.render('redfish.1.0.0.taskcollection.json',
                        'TaskCollection.json#/definitions/TaskCollection',
                        options);
            });
    }).catch(function(error) {
        return redfish.handleError(error, res);
    });
});

module.exports = {
    taskServiceRoot: taskServiceRoot,
    listTasks: listTasks,
    getTask: getTask,
    getSystemTasks: getSystemTasks
};
