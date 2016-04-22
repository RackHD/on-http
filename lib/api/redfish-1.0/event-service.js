// Copyright 2016, EMC, Inc.

'use strict';
var urlParse = require('url-parse');
var injector = require('../../../index.js').injector;
var redfish = injector.get('Http.Api.Services.Redfish');
var schemaApi = injector.get('Http.Api.Services.Schema');
var Promise = injector.get('Promise'); // jshint ignore:line
var _ = injector.get('_');  // jshint ignore:line
var Constants = injector.get('Constants');
var RedfishTool = injector.get('JobUtils.RedfishTool');
var controller = injector.get('Http.Services.Swagger').controller;
var Errors = injector.get('Errors');
var messenger = injector.get('Services.Messenger');
var Logger = injector.get('Logger');
var uuid = injector.get('uuid');
var timeoutInSeconds = 10;
var retryAttempts = 3;
var eventSubscriptions = {};
var subscription;
var logger = Logger.initialize('event-service');

var eventListener = function(callback) {
    if(subscription) {
        return subscription;
    }
    return messenger.subscribe(
        Constants.Protocol.Exchanges.Events.Name,
        'poller.alert.#',
        function(data) {
            callback(data);
        }
    ).then(function(sub) {
        subscription = sub;
        return subscription;
    });
};

var sendClient = function(client, retry, data) {
    return client.clientRequest(client.settings.root, 'POST', data)
    .catch(function(error) {
        if(0 !== retry) {
            logger.warning('Send Error', {
                error:error,
                settings:client.settings,
                retry:retry
            });
            return sendClient(client, retry - 1);
        }
        throw error;
    });
};

var eventCallback = function(events) {
    return _.forEach(events.value, function(event) {
        var clients;
        if(event.reading.sdrType === 'Threshold') {
            clients = _.filter(eventSubscriptions, _.matches({EventTypes:["Alert"]}));
            return _.forEach(clients, function(client) {
                var record = {};
                var parse = urlParse(client.Destination);
                var tool = new RedfishTool();
                tool.settings.host = parse.host.split(':')[0];
                tool.settings.port = parse.port;
                tool.settings.root = parse.pathname;
                tool.settings.recvTimeoutMs = timeoutInSeconds * 1000;
                record.MemberId = event.node;
                record.EventType = "Alert";
                record.EventId = event.reading.sensorId;
                record.EventTimestamp = new Date().toISOString();
                record.Severity = event.reading.status;
                record.Message = event.reading.entryIdName + ' ' + 
                    event.reading.sensorReading + ' ' + 
                    (event.reading.sensorReadingUnits ? event.reading.sensorReadingUnits : '');
                record.MessageId = "Alert.1.0." + 
                    event.reading.sensorId.replace(/[^A-Za-z0-9.]/g,''); 
                return schemaApi.validate(record, 'Event.1.0.0.json#/definitions/EventRecord')
                .then(function(result) {
                    if(result.error) {
                        throw new Error(result.error);
                    }
                    return sendClient(tool, retryAttempts, record);
                })
                .catch(function(error) {
                    throw error;
                });
            });
        }
        if(event.reading.sdrType === 'Discrete') {
            clients = _.filter(eventSubscriptions, _.matches({EventTypes:["StatusChange"]}));
            return _.forEach(clients, function(client) {
                var record = {};
                var parse = urlParse(client.Destination);
                var tool = new RedfishTool();
                tool.settings.host = parse.host.split(':')[0];
                tool.settings.port = parse.port;
                record.MemberId = event.node;
                record.EventType = "StatusChange";
                record.EventId = event.reading.sensorId;
                record.EventTimestamp = new Date().toISOString();
                record.Message = event.reading.entryIdName + ', statesAsserted: ' + 
                    event.reading.statesAsserted.toString();
                record.MessageId = "StatusChange.1.0." + 
                    event.reading.sensorId.replace(/[^A-Za-z0-9.]/g,'');
                return schemaApi.validate(record, 'Event.1.0.0.json#/definitions/EventRecord')
                .then(function(result) {
                    if(result.error) {
                        throw new Error(result.error);
                    }
                    return sendClient(tool, retryAttempts, record);
                })
                .catch(function(error) {
                    throw error;
                });
            });
        }
    });
};

var eventServiceRoot = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);
    return Promise.resolve()
    .then(function() {
        options.timeoutInSeconds = timeoutInSeconds;
        options.retryAttempts = retryAttempts;
        return redfish.render('redfish.1.0.0.eventservice.1.0.0.json',
                'EventService.1.0.0.json#/definitions/EventService',
                options);
    })
    .catch(function(error) {
        return redfish.handleError(error, res);
    });
});

var getEventsCollection = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);
    return Promise.resolve()
    .then(function() {
        options.subscriptions = _.values(eventSubscriptions);
        return redfish.render('redfish.1.0.0.eventdestinationcollection.json',
                'EventDestinationCollection.json#/definitions/EventDestinationCollection',
                options);
    })
    .catch(function(error) {
        return redfish.handleError(error, res);
    });
});

var createSubscription = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);
    var event = req.swagger.params.payload.value;
    return schemaApi.validate(event, 
        'EventDestination.1.0.0.json#/definitions/EventDestination'
    )
    .then(function validatePayload(result) {
        if(result.error) {
            throw new Error(result.error);
        }
        var index = _.findIndex(_.values(eventSubscriptions), function(subscription) {
            return subscription.Destination === event.Destination;
        });
        
        if(index > -1) {
            var err = new Errors.BaseError('EventDestination Exists');
            err.status = 409;
            throw err;
        }
        event.Id = uuid('v4');
        _.set(eventSubscriptions, event.Id, event);
        return event;
    })
    .then(function(output) {
        eventListener(eventCallback);
        res.setHeader('Location', 
            options.basepath + '/EventService/Subscription/' + output.Id
        );
        res.status(201).json(output);
    })
    .catch(function(error) {
        return redfish.handleError(error, res);
    });
});

var testEvent = controller(function(req, res) {
    return Promise.resolve()
    .then(function() {
        return _.forEach(_.values(eventSubscriptions), function(subscription) {
            var record = {};
            var parse = urlParse(subscription.Destination);
            var tool = new RedfishTool();
            tool.settings.host = parse.host.split(':')[0];
            tool.settings.port = parse.port;
            record.MemberId = subscription.Id;
            record.EventType = 'Alert';
            record.EventId = '0';
            record.EventTimestamp = new Date().toISOString();
            record.Message = 'Generated TestEvent to ' + subscription.Destination;
            record.MessageId = 'TestEvent.1.0.0';
            return schemaApi.validate(record, 'Event.1.0.0.json#/definitions/EventRecord')
            .then(function(result) {
                if(result.error) {
                    throw new Error(result.error);
                }
                return sendClient(tool, retryAttempts, record);
            });
        });
    })
    .then(function() {
        res.status(200);
    })
    .catch(function(error) {
        return redfish.handleError(error, res);
    });
});

var getEvent = controller(function(req, res) {
    var options = redfish.makeOptions(req, res);
    var id = req.swagger.params.index.value;
    return Promise.resolve()
    .then(function() {
        var event = _.get(eventSubscriptions, id);
        if(_.isUndefined(event)) {
            throw new Errors.NotFoundError(
                'EventDestination ' + id + ' Not Found'
            );       
        }
        options.subscription = event;
        return redfish.render('redfish.1.0.0.eventdestination.json',
                'EventDestination.1.0.0.json#/definitions/EventDestination',
                options);
    })
    .catch(function(error) {
        return redfish.handleError(error, res);
    });
});

var deleteEvent = controller(function(req, res) {
    var id = req.swagger.params.index.value;
    return Promise.resolve()
    .then(function() {
        var event = _.get(eventSubscriptions, id);
        if(_.isUndefined(event)) {
            throw new Errors.NotFoundError(
                'EventDestination ' + id + ' Not Found'
            );       
        }
        delete eventSubscriptions[id];
    })
    .then(function() {
        if(!_.keys(eventSubscriptions).length) {
            if(subscription) {
                subscription.dispose();
                subscription = undefined;
            }
        }
        res.status(200);
    })
    .catch(function(error) {
        return redfish.handleError(error, res);
    });
});

module.exports = {
    eventServiceRoot: eventServiceRoot,
    createSubscription: createSubscription,
    getEventsCollection: getEventsCollection,
    getEvent: getEvent,
    deleteEvent: deleteEvent,
    testEvent: testEvent,
    eventListener: eventListener,
    sendClient: sendClient,
    eventCallback: eventCallback
};
