'use strict';

var di = require('di'),
    ws = require('ws');

di.annotate(webSocketServerFactory, new di.Provide('WebSocketError'));
di.annotate(webSocketServiceFactory, new di.Inject('Errors', 'Util'));

function webSocketErrorFactory(Errors, Util) {
  function WebSocketError(msg, ctx) {
    Errors.BaseError.call(this, msg, ctx);
    Error.captureStackTrace(this, WebSocketError);
  }
  Util.inherits(WebSocketError, Errors.BaseError);
  return WebSocketError;
}

di.annotate(webSocketResourcesFactory, new di.Provide('WebSocketResources'));
di.annotate(webSocketResourcesFactory, new di.Inject(
  'Constants', 'Services.Waterline', 'Services.Messenger'
));

function webSocketResourcesFactory(Constants, collections, messenger) {
  return {
    catalogs: mongoCollectionResource(collections.catalogs, 'catalogs'),
    files: mongoCollectionResource(collections.files, 'files'),
    graphDefs: mongoCollectionResource(collections.graphdefinitions, 'graphDefs'),
    graphObjs: mongoCollectionResource(collections.graphobjects, 'graphObjs'),
    logs: mongoCollectionResource(collections.logs, 'logs'),
    lookups: mongoCollectionResource(collections.lookups, 'lookups'),
    mq: {
      query: function (msg, wsConn, rawMsg) {
        this.logger.warn('MQ resource does not support query method.', {
          rawMessage: rawMsg,
          webSocketConnection: wsConn,
          webSocketService: this
        });
      },
      all: function (msg, wsConn) {
        this.logger.warn('MQ resource does not support all method.', {
          rawMessage: rawMsg,
          webSocketConnection: wsConn,
          webSocketService: this
        });
      },
      get: function (msg, wsConn) {
        this.logger.warn('MQ resource does not support get method.', {
          rawMessage: rawMsg,
          webSocketConnection: wsConn,
          webSocketService: this
        });
      },
      watch: function (msg, wsConn) {
        msg.params = msg.params || {};
        wsConn.addWatcher(msg.params, messenger.subscribe(
          msg.params.exchange,
          msg.params.routingKey,
          function (data, message) { wsConn.sendItem('mq', data.id, data); }
        ));
      },
      stop: function (msg, wsConn) {
        wsConn.removeWatchers(msg.params);
      }
    },
    nodes: mongoCollectionResource(collections.nodes, 'nodes'),
    pollers: mongoCollectionResource(collections.workitems, 'pollers'),
    profiles: mongoCollectionResource(collections.profiles, 'profiles'),
    skus: mongoCollectionResource(collections.skus, 'skus'),
    taskDefs: mongoCollectionResource(collections.taskdefinitions, 'taskDefs'),
    templates: mongoCollectionResource(collections.templates, 'templates'),
  };
  function mongoCollectionResource(collection, resource) {
    return {
      query: function (msg, wsConn) {
        return collection.find(msg.params).then(
          function (items) { wsConn.sendList(resource, items); },
          function (err) { wsConn.sendError(err, resource); });
      },
      all: function (msg, wsConn) {
        return collection.getAll().then(
          function (items) { wsConn.sendList(resource, items); },
          function (err) { wsConn.sendError(err, resource); });
      },
      get: function (msg, wsConn) {
        return collection.get(req.params).then(
          function (data) { wsConn.sendList(resource, data); },
          function (err) { wsConn.sendError(err, resource); });
      },
      watch: function (msg, wsConn) {
        msg.params = msg.params || {};
        msg.params.exchange = Constants.Protocol.Exchanges.Waterline.Name,
        msg.params.routingKey = collection.identity + '.$';
        return wsConn.addWatcher(params, messenger.subscribe(
          msg.params.exchange,
          msg.params.routingKey,
          function (data, message) {
            var keys = message.deliveryInfo.routingKey.split('.'),
                event = keys[3],
                id = keys[4];
            if (event === 'destroyed') {
              return wsConn.sendRemove(resource, id || data.id, data);
            }
            return wsConn.sendItem(resource, id || data.id, data);
          }
        ));
      },
      stop: function (msg, wsConn) {
        msg.params = msg.params || {};
        msg.params.exchange = Constants.Protocol.Exchanges.Waterline.Name,
        msg.params.routingKey = collection.identity + '.$';
        wsConn.removeWatchers(params);
      }
    }
  }
}

di.annotate(webSocketServerFactory, new di.Provide('WebSocketServer'));

function webSocketServerFactory() {
  return ws.Server;
}

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
    this.logger.info('Client:' + wsConn.id + ' connected to WebSocketServer.', {
      webSocketConnection: wsConn,
      webSocketService: this
    });
    wsConn.id = (Math.floor(1048576 + Math.random() * 33554431)).toString(32);
    this.sessions[wsConn.id] = wsConn;
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
        wsConn.watchers[hash].forEach(function (watcher) { watcher.dispose(); });
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
    this.logger.info('Client:' + wsConn.id + ' disconnected from WebSocketServer.', {
      webSocketConnection: wsConn,
      webSocketService: this
    });
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
      rawMessage: wsMsg,
      webSocketConnection: wsConn,
      webSocketService: this
    });
    try {
      var msg = JSON.parse(wsMsg);
    } catch (err) {
      throw new WebSocketError('Malformed message.', {
        rawMessage: wsMsg,
        webSocketConnection: wsConn,
        webSocketService: this
      });
    }
    if (typeof this.handlers[msg.handler] === 'function') {
      this.handlers[msg.handler].call(this, msg, wsConn, wsMsg);
    }
    throw new WebSocketError('Invalid message.', {
      rawMessage: wsMsg,
      webSocketConnection: wsConn,
      webSocketService: this
    });
  }

  function defaultMessageHandlers() {
    var handlers = {};
    handlers.init = function (msg, wsConn) {
      wsConn.sendSession();
    };
    handlers.error = function (msg, wsConn) {
      this.logger.error(msg.message, {
        errorObject: msg,
        webSocketConnection: wsConn,
        webSocketService: this
      });
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
        rawMessage: wsMsg,
        webSocketConnection: wsConn,
        webSocketService: this
      });
      var resource = msg.resource || wsConn.upgradeReq.url.split('/').pop();
      if (this.resources[resource] && typeof this.resources[resource][method] === 'function') {
        return this.resources[resource][method].call(this, msg, wsConn, rawMsg);
      }
      throw new WebSocketError('Invalid WebSocketResource: ' + msg.resource, {
        handler: method,
        rawMessage: rawMsg,
        webSocketConnection: wsConn,
        webSocketService: this
      });
    }
  }

  return {
    broadcast: function (data, skipFunc) {
      if (!this.webSocketServer) {
        throw new WebSocketError('Broadcast failed, no server is available.', {
          webSocketService: this
        });
      }
      this.webSocketServer.clients.forEach(function wsClientBroadcast(wsConn) {
        if (typeof skipFunc === 'function' && skipFunc(wsConn)) return;
        try {
          client.send(data);
        } catch (err) {
          this.logger.warn('Failed to send message to client:' + wsConn.id, {
            webSocketConnection: wsConn,
            webSocketService: this
          });
          closeConnection.call(this, wsConn);
        }
      }.bind(this));
    },

    handlers: defaultMessageHandlers(),

    initialize: function (httpServer, params) {
      this.httpServer = httpServer;
      try {
        this.logger.info('Creating WebSocketServer, and initializing WebSocketService...', {
          webSocketService: this
        });
        this.webSocketServer = new WebSocketServer({server: httpServer});
        this.webSocketServer.on('connection', handleConnection.bind(this));
      } catch (err) {
        throw new WebSocketError(err.message, {
          originalError: err,
          webSocketService: this
        });
      }
      return this;
    },

    logger: Logger.initialize(webSocketServiceFactory),
    resources: webSocketResources,
    sessions: {}
  };
}
