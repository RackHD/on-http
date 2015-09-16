'use strict';

var di = require('di'),
    ws = require('ws');

module.exports = webSocketServiceFactory;

di.annotate(webSocketServiceFactory, new di.Provide('Services.WebSocket'));
di.annotate(webSocketServiceFactory, new di.Inject(
  'Logger',
  'Services.Configuration',
  'WebSocketError',
  'WebSocketResources',
  'WebSocketServer'
));

function webSocketServiceFactory(
  Logger,
  serviceConfiguration,
  WebSocketError,
  webSocketResources,
  WebSocketServer
) {
  function handleConnection(wsConn) {
    wsConn.id = (Math.floor(1048576 + Math.random() * 33554431)).toString(32);
    this.sessions[wsConn.id] = wsConn;
    this.logger.info('Client:' + wsConn.id + ' connected to WebSocketServer.');
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
          if (watcher) watcher.dispose();
        });
        delete wsConn.watchers[hash];
        return true;
      }
    };
    wsConn.sendError = function (err, resource) {
      return wsConn.send(JSON.stringify({handler: 'error', resource: resource, params: err}));
    };
    wsConn.sendItem = function (resource, id, data) {
      return wsConn.send(JSON.stringify({handler: 'item', resource: resource, id: id, data: data}));
    };
    wsConn.sendList = function (resource, items) {
      return wsConn.send(JSON.stringify({handler: 'list', resource: resource, items: items}));
    };
    wsConn.sendRemove = function (resource, id, data) {
      return wsConn.send(JSON.stringify({handler: 'remove', resource: resource, id: id, data: data}));
    };
    wsConn.sendSession = function () {
      return wsConn.send(JSON.stringify({handler: 'session', id: wsConn.id}));
    };
    wsConn.on('message', handleMessage.bind(this, wsConn));
    wsConn.on('error', closeConnection.bind(this, wsConn));
    wsConn.on('close', closeConnection.bind(this, wsConn));
  }

  function closeConnection(wsConn) {
    if (!this.sessions[wsConn.id]) return;
    this.logger.info('Client:' + wsConn.id + ' disconnected from WebSocketServer.');
    delete this.sessions[wsConn.id];
    if (wsConn.watchers) {
      Object.keys(wsConn.watchers).forEach(function (watcherHash) {
        var watcherList = wsConn.watchers[watcherHash];
        if (watcherList) watcherList.forEach(function (watcher) {
          watcher.dispose();
        });
      });
      delete wsConn.watchers;
    }
    try { wsConn.terminate(); } catch (err) {}
  }

  function handleMessage(wsConn, wsMsg) {
    this.logger.info('Client:' + wsConn.id + ' messsage was received.', {
      rawMessage: wsMsg
    });
    try {
      var msg = JSON.parse(wsMsg);
    } catch (err) {
      return this.error(new WebSocketError('Malformed message from: ' + wsConn.id, {
        rawMessage: wsMsg
      }));
    }
    if (typeof this.handlers[msg.handler] === 'function') {
      return this.handlers[msg.handler].call(this, msg, wsConn, wsMsg);
    }
    this.error(new WebSocketError('Invalid message from: ' + wsConn.id, {
      rawMessage: wsMsg,
      parsedMessage: msg
    }));
  }

  function defaultMessageHandlers() {
    var handlers = {};
    handlers.init = function (msg, wsConn) {
      wsConn.sendSession();
    };
    handlers.error = function (msg, wsConn) {
      this.error(msg.message, {errorObject: msg});
    };
    handlers.query = function (msg, wsConn, rawMsg) {
      return forwardResourceMethod.call(this, 'query', msg, wsConn, rawMsg);
    };
    handlers.all = function (msg, wsConn, rawMsg) {
      return forwardResourceMethod.call(this, 'all', msg, wsConn, rawMsg);
    };
    handlers.get = function (msg, wsConn, rawMsg) {
      return forwardResourceMethod.call(this, 'get', msg, wsConn, rawMsg);
    };
    handlers.watch = function (msg, wsConn, rawMsg) {
      return forwardResourceMethod.call(this, 'watch', msg, wsConn, rawMsg);
    };
    handlers.stop = function (msg, wsConn, rawMsg) {
      return forwardResourceMethod.call(this, 'stop', msg, wsConn, rawMsg);
    };
    return handlers;
    function forwardResourceMethod(method, msg, wsConn, rawMsg) {
      this.logger.info('Client:' + wsConn.id + ' requested a resource call.', {
        rawMessage: rawMsg
      });
      var resource = msg.resource || wsConn.upgradeReq.url.split('/').pop();
      if (this.resources[resource] && typeof this.resources[resource][method] === 'function') {
        return this.resources[resource][method].call(this, msg, wsConn, rawMsg);
      }
      this.error(new WebSocketError('Invalid WebSocketResource: ' + msg.resource, {
        rawMessage: rawMsg
      }));
    }
  }

  return {
    broadcast: function (data, skipFunc) {
      if (!this.webSocketServer) {
        this.error(new WebSocketError('Broadcast failed, no server is available.'));
      }
      this.webSocketServer.clients.forEach(function wsClientBroadcast(wsConn) {
        if (typeof skipFunc === 'function' && skipFunc(wsConn)) return;
        try {
          client.send(data);
        } catch (err) {
          this.logger.warn('Failed to send message to client:' + wsConn.id);
          closeConnection.call(this, wsConn);
        }
      }.bind(this));
    },

    error: function (wsError) {
      this.logger.error(wsError.message, wsError);
    },

    handlers: defaultMessageHandlers(),
    logger: Logger.initialize(webSocketServiceFactory),
    resources: webSocketResources,
    sessions: {},

    start: function (httpServer, params) {
      if (!httpServer) {
        this.logger.info('Starting WebSocketService...');
        return this;
      }
      this.httpServer = httpServer;
      try {
        this.logger.info('Creating WebSocketServer, and initializing WebSocketService...');
        this.webSocketServer = new WebSocketServer({server: httpServer});
        this.webSocketServer.on('connection', handleConnection.bind(this));
      } catch (err) {
        this.error(new WebSocketError(err.message, {
          originalError: err
        }));
      }
      return this;
    },

    stop: function () {
      this.logger.info('Stopping WebSocketService...');
      if (this.webSocketServer) this.webSocketServer.close();
      delete this.httpServer;
      delete this.webSocketServer;
    }
  };
}
