// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di');

module.exports = webSocketServiceFactory;

di.annotate(webSocketServiceFactory, new di.Provide('Services.WebSocket'));
di.annotate(webSocketServiceFactory, new di.Inject(
    'Logger',
    'Services.Configuration',
    'uuid',
    'WebSocketError',
    'WebSocketResources',
    'WebSocketServer'
));

function webSocketServiceFactory(
    Logger,
    serviceConfiguration,
    uuid,
    WebSocketError,
    webSocketResources,
    WebSocketServer
) {
    var logger = Logger.initialize(webSocketServiceFactory);

    function WebSocketService() {
        this.handlers = this._defaultMessageHandlers(),
        this.resources = webSocketResources;
        this.sessions = {};
    }

    WebSocketService.prototype.broadcast = function (data, skipFunc) {
        if (!this.webSocketServer) {
            this.error(new WebSocketError('Broadcast failed, no server is available.'));
        }

        var wsService = this;
        this.webSocketServer.clients.forEach(wsClientBroadcast);

        function wsClientBroadcast(wsConn) {
            if (typeof skipFunc === 'function' && skipFunc(wsConn)) { return; }

            try {
                wsConn.send(data);
            }

            catch (err) {
                logger.warning('Failed to send message to client: %s'.format(wsConn.id));

                wsService._closeConnection(wsConn);
            }
        }
    };

    WebSocketService.prototype.error = function (wsError) {
        logger.error(wsError.message, wsError);
    };

    WebSocketService.prototype.start = function (httpServer) {
        if (!httpServer) {
            logger.info('Starting WebSocketService...');

            return this;
        }

        this.httpServer = httpServer;

        try {
            logger.info('Creating WebSocketServer, and initializing WebSocketService...');

            this.webSocketServer = new WebSocketServer({server: httpServer});

            this.webSocketServer.on('connection', this._handleConnection.bind(this));
        }

        catch (err) {
            this.error(new WebSocketError(err.message, {originalError: err}));
        }

        return this;
    };

    WebSocketService.prototype.stop = function () {
        logger.info('Stopping WebSocketService...');

        if (this.webSocketServer) { this.webSocketServer.close(); }

        delete this.httpServer;
        delete this.webSocketServer;
    };

    WebSocketService.prototype._closeConnection = function (wsConn) {
        if (!this.sessions[wsConn.id]) { return; }

        logger.debug('Client: %s disconnected from WebSocketServer.'.format(wsConn.id));

        delete this.sessions[wsConn.id];

        if (wsConn.watchers) {
            Object.keys(wsConn.watchers).forEach(function (watcherHash) {
                var watcherList = wsConn.watchers[watcherHash];

                if (watcherList) {
                    watcherList.forEach(function (watcher) {
                        watcher.dispose();
                    });
                }
            });

            delete wsConn.watchers;
        }

        try { wsConn.terminate(); } catch (err) {}
    };

    WebSocketService.prototype._defaultMessageHandlers = function () {
        var handlers = {};

        handlers.init = function (msg, wsConn) {
            wsConn.sendSession();
        };

        handlers.error = function (msg) {
            this.error(msg.message, {errorObject: msg});
        };

        handlers.query = function (msg, wsConn, rawMsg) {
            return this._forwardResourceMethod('query', msg, wsConn, rawMsg);
        };

        handlers.all = function (msg, wsConn, rawMsg) {
            return this._forwardResourceMethod('all', msg, wsConn, rawMsg);
        };

        handlers.get = function (msg, wsConn, rawMsg) {
            return this._forwardResourceMethod('get', msg, wsConn, rawMsg);
        };

        handlers.watch = function (msg, wsConn, rawMsg) {
            return this._forwardResourceMethod('watch', msg, wsConn, rawMsg);
        };

        handlers.stop = function (msg, wsConn, rawMsg) {
            return this._forwardResourceMethod('stop', msg, wsConn, rawMsg);
        };

        return handlers;
    };

    WebSocketService.prototype._forwardResourceMethod = function (method, msg, wsConn, rawMsg) {
        logger.debug('Client: %s requested a resource call.'.format(wsConn.id),
            {rawMessage: rawMsg});

        var resource = msg.resource || wsConn.upgradeReq.url.split('/').pop();

        if (this.resources[resource] && typeof this.resources[resource][method] === 'function') {
            return this.resources[resource][method].call(this, msg, wsConn, rawMsg);
        }

        this.error(new WebSocketError('Invalid WebSocketResource: %s'.format(msg.resource),
            {rawMessage: rawMsg}));
    };

    WebSocketService.prototype._handleConnection = function (wsConn) {
        wsConn.id = uuid('v4');

        this.sessions[wsConn.id] = wsConn;

        logger.debug('Client: %s connected to WebSocketServer.'.format(wsConn.id));

        wsConn.addWatcher = function (params, watcher) {
            var hash = JSON.stringify(params);

            wsConn.watchers = wsConn.watchers || {};
            wsConn.watchers[hash] = wsConn.watchers[hash] || [];
            wsConn.watchers[hash].push(watcher);

            return watcher;
        };

        wsConn.removeWatchers = function (params) {
            var hash = JSON.stringify(params);

            if (wsConn.watchers && wsConn.watchers[hash]) {
                wsConn.watchers[hash].forEach(function (watcher) {
                    if (watcher)  { watcher.dispose(); }
                });

                delete wsConn.watchers[hash];

                return true;
            }
        };

        wsConn.sendError = function (err, resource) {
            return this.sendObject({handler: 'error', resource: resource, params: err});
        };

        wsConn.sendItem = function (resource, id, data) {
            return this.sendObject({handler: 'item', resource: resource, id: id, data: data});
        };

        wsConn.sendList = function (resource, items) {
            return this.sendObject({handler: 'list', resource: resource, items: items});
        };

        wsConn.sendObject = function (object) {
            return wsConn.send(JSON.stringify(object));
        };

        wsConn.sendRemove = function (resource, id, data) {
            return this.sendObject({handler: 'remove', resource: resource, id: id, data: data});
        };

        wsConn.sendSession = function () {
            return this.sendObject({handler: 'session', id: wsConn.id});
        };

        wsConn.on('message', this._handleMessage.bind(this, wsConn));

        wsConn.on('error', this._closeConnection.bind(this, wsConn));
        wsConn.on('close', this._closeConnection.bind(this, wsConn));
    };

    WebSocketService.prototype._handleMessage = function (wsConn, wsMsg) {
        logger.debug('Client: %s messsage was received.'.format(wsConn.id),
            {rawMessage: wsMsg});

        var msg;

        try { msg = JSON.parse(wsMsg); }

        catch (err) {
            return this.error(new WebSocketError('Malformed message from: %s'.format(wsConn.id),
                {rawMessage: wsMsg}));
        }

        if (typeof this.handlers[msg.handler] === 'function') {
            return this.handlers[msg.handler].call(this, msg, wsConn, wsMsg);
        }

        this.error(new WebSocketError('Invalid message from: %s'.format(wsConn.id),
            {rawMessage: wsMsg, parsedMessage: msg}));
    };

    return new WebSocketService();
}
