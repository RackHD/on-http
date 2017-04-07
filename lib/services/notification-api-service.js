// Copyright © 2016-2017 Dell Inc. or its subsidiaries.  All Rights Reserved.

'use strict';

var di = require('di');

module.exports = NotificationApiServiceFactory;
di.annotate(NotificationApiServiceFactory, new di.Provide('Http.Services.Api.Notification'));
di.annotate(NotificationApiServiceFactory,
    new di.Inject(
        'Protocol.Events',
        'Protocol.Task',
        'Task.Messenger',
        'Logger',
        'Services.Waterline',
        'Errors',
        'Promise',
        'Services.GraphProgress',
        '_',
        'Services.Lookup',
        'Constants'
    )
);

function NotificationApiServiceFactory(
    eventsProtocol,
    taskProtocol,
    taskMessenger,
    Logger,
    waterline,
    Errors,
    Promise,
    graphProgressService,
    _,
    lookup,
    Constants
) {
    var logger = Logger.initialize(NotificationApiServiceFactory);

    function NotificationApiService() {
    }

    NotificationApiService.prototype.postNotification = function(message) {
        var self = this;

        if (_.has(message, 'nodeId')) {
            return self.postNodeNotification(message);
        }
        else {
            // This will be a broadcast notification if no id (like nodeId) is specified
            return self.postBroadcastNotification(message);
        }
    };

    NotificationApiService.prototype.publishTaskProgress = function(message) {
        if(!_.isString(message.taskId)) {
            throw new Errors.BadRequestError('taskId is required for progress notification');
        }
        if(!message.maximum) {
            throw new Errors.BadRequestError('maximum is required for progress notification');
        }
        if(!message.value) {
            throw new Errors.BadRequestError('value is required for progress notification');
        }

        if (message.value) {
            message.value = parseInt(message.value);
        }
        if (message.maximum) {
            message.maximum = parseInt(message.maximum);
        }
        var progressData = _.pick(message, ['maximum', 'value', 'description']);

        return waterline.taskdependencies.findOne({taskId: message.taskId})
        .then(function(task) {
            if (_.isEmpty(_.get(task, 'graphId'))) {
                throw new Errors.BadRequestError('Cannot find the task for taskId ' + message.taskId); //jshint ignore: line
            }

            return graphProgressService.publishTaskProgress(
                task.graphId,
                message.taskId,
                progressData,
                {swallowError: false}
            );
        });
    };

    NotificationApiService.prototype.postNodeNotification = function(message) {

        return Promise.try(function() {
            if (!message.nodeId || !_.isString(message.nodeId)) {
                throw new Errors.BadRequestError('Invalid node ID in query or body');
            }
        })
        .then(function () {
            return waterline.nodes.needByIdentifier(message.nodeId);
        })
        .then(function (node) {
            if(!node) {
                throw new Errors.BadRequestError('Node not found');
            }
            return eventsProtocol.publishNodeNotification(message.nodeId, message);
        })
        .then(function () {
            return message;
        });
    };

    NotificationApiService.prototype.postBroadcastNotification = function(message) {
        return eventsProtocol.publishBroadcastNotification(message)
        .then(function () {
            return message;
        });
    };
    NotificationApiService.prototype.redfishAlertProcessing = function(req) {
        /*
        The alert would look like the json below when published on the AMQP bus.
        It is compliant with RackHD notification standard.
        Notification Type is "node" and action is "alerts"

         {
         "type": "node",
         "action": "alerts",
         "typeId": "58d94cec316779d4126be134",
         "data": {
             "Context": "context string",
             "EventId": "8689",
             "EventTimestamp": "2017-03-29T15:39:34-0500",
             "EventType": "Alert",
             "MemberId": "7e675c8e-127a-11e7-9fc8-64006ac35232",
             "Message": "The coin cell battery in CMC 1 is not working.",
             "MessageArgs": ["1"],
             "MessageArgs@odata.count": 1,
             "MessageId": "CMC8572",
             "Severity": "Critical",
             "sourceIpAddress": "10.240.19.130",
             "nodeId": "58d94cec316779d4126be134",
             "ChassisName": "PowerEdge R630",
             "ServiceTag": "4666482",
             "SN": "CN747515A80855"
         },
         "severity": "critical",
         "version": "1.0",
         "createdAt": "2017-03-29T19:44:12.972Z"
         }
         */
        var amqpMessage = {};

        return new Promise.resolve()
            .then(function(){
                return getAlert(req);
            })
            .then(function(data){
                amqpMessage = data;
                return getObm(amqpMessage.data.sourceIpAddress);
            })
            .then(function(obm){
                return  updateBmcInfo(amqpMessage, obm);
            })
            .then(function(data){
                return updateDeviceInfo(data);
            })
            .tap(function(data){
                return eventsProtocol.publishExternalEvent(data);
            });
    };

    function getAlert (req) {
        var amqpMessage = {};
        var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress ||
            req.socket.remoteAddress || req.connection.socket.remoteAddress;
        logger.info("Alert was received from the node with IP: " + ip);
        var alert = _.defaults(req.swagger.query || {},req.query || {}, req.body || {});
        if(typeof(alert) === 'object' &&  Object.keys(alert).length > 0) {
            //Format the amqp message by adopting the rackHD notification standard
            amqpMessage.type = "node";
            amqpMessage.action = "alerts";
            amqpMessage.data = alert;
            amqpMessage.data.sourceIpAddress = ip;
            if (alert.hasOwnProperty("Severity")) {
                amqpMessage.severity = alert.Severity.toLowerCase();
            }

            return amqpMessage;
        }
        else{
            //Unexpected decoded "x-www-forum-urlencoded" data
            throw new Errors.BadRequestError(
                'Unexpected alert data'
            );
        }
    }

    function getObm(ip){
        return waterline.obms.findOne({"config.host": ip, "service" : "ipmi-obm-service" })
            .then(function(obm) {
                if (obm !== undefined) {
                    return obm;
                }else{
                    return lookup.lookupByIP(ip)
                        .then(function(lookup){
                            if(lookup !== undefined){
                                var macAdd = lookup.macAddress;
                                return waterline.obms.findOne({"config.host": macAdd, "service" : "ipmi-obm-service" })// jshint ignore:line
                                    .then(function(obm){
                                        return obm;
                                    });
                            }
                            return lookup;
                        });
                }
            });
    }

    function updateBmcInfo(amqpMessage, obm) {
        var ip = amqpMessage.data.sourceIpAddress;

            if (obm !== undefined && Constants.Regex.IpAddress.test(obm.config.host)) {
                //obm.config.host is an IP
                return waterline.catalogs.findMostRecent({"node": obm.node, source: "bmc"})// jshint ignore:line
                    .then(function (bmcCatalog) {
                        if (bmcCatalog !== undefined && bmcCatalog.hasOwnProperty("node") && bmcCatalog.node !== "") { // jshint ignore:line
                            return extractBmcInfo(amqpMessage, bmcCatalog);
                        }
                    });
            }else if (obm !== undefined && Constants.Regex.MacAddress.test(obm.config.host)) {
                //obm.config.host is a mac address
                amqpMessage.typeId = obm.node;
                amqpMessage.data.nodeId = obm.node;
                amqpMessage.data.macAddress = obm.config.host;

                return amqpMessage;
            }else{
                return waterline.catalogs.findMostRecent({ "data.IP Addresss": ip, source: "bmc"})
                    .then(function(bmcCatalog) {
                        if (bmcCatalog !== undefined && bmcCatalog.hasOwnProperty("node") && bmcCatalog.node !== "") {// jshint ignore:line
                            return extractBmcInfo(amqpMessage, bmcCatalog);
                        }else{
                            //unrecognized node
                            throw new Errors.BadRequestError("unrecognized node");
                        }
                    });
            }
    }
 
    function extractBmcInfo(amqpMessage, bmcCatalog){
        amqpMessage.typeId = bmcCatalog.node;
        amqpMessage.data.nodeId = bmcCatalog.node;
        amqpMessage.data.macAddress = bmcCatalog.data["MAC Address"];

        return amqpMessage;
    }

    function updateDeviceInfo(amqpMessage) {
        amqpMessage.data.ChassisName = null;
        amqpMessage.data.ServiceTag = null;
        amqpMessage.data.SN = null;

        return waterline.catalogs.findMostRecent({source: "ipmi-fru"})
            .then(function(catalogIpmiFru){
                if(catalogIpmiFru !== undefined && catalogIpmiFru.data.hasOwnProperty("Builtin FRU Device (ID 0)")){// jshint ignore:line
                    var deviceInfoCatalog = catalogIpmiFru.data["Builtin FRU Device (ID 0)"];

                    //Add useful information to the alert message
                    if (deviceInfoCatalog.hasOwnProperty("Board Product")){
                        amqpMessage.data.ChassisName = deviceInfoCatalog["Board Product"];
                    }
                    if (deviceInfoCatalog.hasOwnProperty("Product Serial")) {
                        amqpMessage.data.ServiceTag = deviceInfoCatalog["Product Serial"];
                    }
                    if (deviceInfoCatalog.hasOwnProperty("Board Serial")) {
                        amqpMessage.data.SN = deviceInfoCatalog["Board Serial"];
                    }
                }
                return amqpMessage;
            });

    }

    return new NotificationApiService();
}
