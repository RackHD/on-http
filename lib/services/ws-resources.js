// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di');

module.exports = webSocketResourcesFactory;

di.annotate(webSocketResourcesFactory, new di.Provide('WebSocketResources'));
di.annotate(webSocketResourcesFactory, new di.Inject(
    'Constants', 'Logger', 'Services.Waterline', 'Services.Messenger'
));

function webSocketResourcesFactory(Constants, Logger, collections, messenger) {
    var logger = Logger.initialize(webSocketResourcesFactory);

    return {
        catalogs: mongoCollectionResource(collections, 'catalogs', 'catalogs'),

        files: mongoCollectionResource(collections, 'files', 'files'),

        graphDefs: mongoCollectionResource(collections, 'graphdefinitions', 'graphDefs'),

        graphObjs: mongoCollectionResource(collections, 'graphobjects', 'graphObjs'),

        logs: mongoCollectionResource(collections, 'logs', 'logs'),

        lookups: mongoCollectionResource(collections, 'lookups', 'lookups'),

        mq: {
            query: function (msg, wsConn, rawMsg) {
                logger.warning('MQ resource does not support query method.', {rawMessage: rawMsg});
            },
            all: function (msg, wsConn, rawMsg) {
                logger.warning('MQ resource does not support all method.', {rawMessage: rawMsg});
            },
            get: function (msg, wsConn, rawMsg) {
                logger.warning('MQ resource does not support get method.', {rawMessage: rawMsg});
            },

            watch: function (msg, wsConn) {
                msg.params = msg.params || {};

                messenger.subscribe(
                    msg.params.exchange,
                    msg.params.routingKey,

                    function (data, message) {
                        wsConn.sendItem('mq', message.deliveryInfo.routingKey, data);
                    }
                ).then(
                    function (subscription) {
                        wsConn.addWatcher(msg.params, subscription);
                    },

                    function (err) {
                        wsConn.sendError(err, 'mq');
                    }
                );
            },

            stop: function (msg, wsConn) {
                wsConn.removeWatchers(msg.params);
            }
        },

        nodes: mongoCollectionResource(collections, 'nodes', 'nodes'),

        pollers: mongoCollectionResource(collections, 'workitems', 'pollers'),

        profiles: mongoCollectionResource(collections, 'profiles', 'profiles'),

        skus: mongoCollectionResource(collections, 'skus', 'skus'),

        taskDefs: mongoCollectionResource(collections, 'taskdefinitions', 'taskDefs'),

        templates: mongoCollectionResource(collections, 'templates', 'templates'),
    };

    function mongoCollectionResource(collections, name, resource) {
        return {
            query: function (msg, wsConn) {
                return collections[name].find(msg.params).then(
                    function (items) { wsConn.sendList(resource, items); },
                    function (err) { wsConn.sendError(err, resource); });
            },

            all: function (msg, wsConn) {
                return collections[name].find({}).then(
                    function (items) { wsConn.sendList(resource, items); },
                    function (err) { wsConn.sendError(err, resource); });
            },

            get: function (msg, wsConn) {
                return collections[name].findOne(msg.params).then(
                    function (data) { wsConn.sendItem(resource, data); },
                    function (err) { wsConn.sendError(err, resource); });
            },

            watch: function (msg, wsConn) {
                msg.params = msg.params || {};
                msg.params.exchange = Constants.Protocol.Exchanges.Waterline.Name,
                msg.params.routingKey = collections[name].identity + '.#';

                return messenger.subscribe(
                    msg.params.exchange,
                    msg.params.routingKey,

                    function (data, message) {
                        var keys = message.deliveryInfo.routingKey.split('.'),
                                id = keys.pop(),
                                event = keys.pop();

                        if (event === 'destroyed') {
                            return wsConn.sendRemove(resource, id, data.record);
                        }

                        return wsConn.sendItem(resource, [event, id], data.record);
                    }
                ).then(
                    function (subscription) {
                        wsConn.addWatcher(msg.params, subscription);
                    },

                    function (err) {
                        wsConn.sendError(err, resource);
                    }
                );
            },

            stop: function (msg, wsConn) {
                msg.params = msg.params || {};
                msg.params.exchange = Constants.Protocol.Exchanges.Waterline.Name,
                msg.params.routingKey = collections[name].identity + '.#';

                wsConn.removeWatchers(msg.params);
            }
        };
    }
}
