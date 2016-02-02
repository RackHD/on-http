// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var redfish = injector.get('Http.Api.Services.Redfish');
var waterline = injector.get('Services.Waterline');
var Promise = injector.get('Promise'); // jshint ignore:line
var _ = injector.get('_');  // jshint ignore:line
var moment = require('moment');

module.exports = {
    taskServiceRoot: taskServiceRoot,
    listTasks: listTasks,
    getTask: getTask,
    getSystemTasks: getSystemTasks
};

var dataFactory = function(identifier, dataName) {
    var statusMap = {
        'valid': 'Running',
        'succeeded': 'Completed',
        'cancelled': 'Killed',
        'failed':  'Exception'
    };

    switch(dataName)  {
        case 'graphObjects':
            return Promise.map(waterline.graphobjects.find({}), function(graph) {
                return { 
                    state: statusMap[graph._status],
                    id: graph.id,
                    status: 'OK',
                    startTime: moment.utc(graph.createdAt).format(),
                    endTime: (graph._status !== 'valid') ? 
                        moment.utc(graph.updatedAt).format() : 
                        '',
                    name: graph.name,
                    systemId: graph.node
                };
            });
    }
};

function taskServiceRoot(req, res) {
    var options = {};
    options.basepath = req.swagger.operation.api.basePath;
    options.templateScope = ['global'];
    options.url = req.url;
    options.dateTime = moment.utc().format();
    options.systems = [];

    Promise.all([ dataFactory('', 'graphObjects') ])
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
    }).then(function(output) {
        res.status(200).json(output);
    })
    .catch(function(error) {
        res.status(500).json(error);
    });
}

function listTasks(req, res) {
    var options = {};
    options.basepath = req.swagger.operation.api.basePath;
    options.templateScope = ['global'];
    options.url = req.url;
    options.dateTime = moment.utc().format();

    Promise.all([ dataFactory('', 'graphObjects') ])
        .spread(function(graphs) {
            options.graphs = graphs;
            return redfish.render('redfish.1.0.0.taskcollection.json', 
                 'TaskCollection.json#/definitions/TaskCollection',
                  options);
    }).then(function(output) {
        res.status(200).json(output);
    })
    .catch(function(error) {
        res.status(500).json(error);
    });
}

function getTask(req, res) {
    var identifier = req.swagger.params.identifier.value;
    var options = {};
    options.basepath = req.swagger.operation.api.basePath;
    options.templateScope = ['global'];
    options.url = req.url;
    options.identifier = identifier;

    Promise.all([ dataFactory('', 'graphObjects') ])
        .spread(function(graphs) {
            options.graphs = _.filter(graphs, function(graph) {
                return graph.id === identifier;
            });
            options.graph = options.graphs[0];

            return redfish.render('redfish.1.0.0.task.1.0.0.json', 
                 'Task.1.0.0.json#/definitions/Task',
                  options);
    }).then(function(output) {
        res.status(200).json(output);
    })
    .catch(function(error) {
        res.status(500).json(error);
    });
}

function getSystemTasks(req, res) {
    var identifier = req.swagger.params.identifier.value;
    var options = {};
    options.basepath = req.swagger.operation.api.basePath;
    options.templateScope = ['global'];
    options.url = req.url;
    options.identifier = identifier;

    waterline.nodes.needByIdentifier(identifier)
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
    }).then(function(output) {
        res.status(200).json(output);
    })
    .catch(function(error) {
        res.status(500).json(error);
    });
}

