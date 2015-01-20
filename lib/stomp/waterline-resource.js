/*
 * Copyright 2014, Renasar Technologies Inc.
 * Created by jfg on 10/20/14.
 */
/* jshint node: true */

'use strict';

require('es6-shim');
/* global Map: false */

var di = require('di');
var util = require('util');

module.exports = WaterlineResourceFactory;

di.annotate(WaterlineResourceFactory, new di.Provide('Stomp.WaterlineResource'));
di.annotate(WaterlineResourceFactory,
    new di.Inject(
        'Q',
        'Assert',
        'MQ',
        '_',
        'Services.Waterline'
    )
);

var LAST_UPDATED_HEADER = 'last-updated';

function WaterlineResourceFactory(Q, assert, mq, _, waterline) {
    var BaseResource = mq.BaseResource;
    var ServerFrame = mq.StompFrames.ServerFrame;
    util.inherits(WaterlineResource, BaseResource);

    /**
     * Publishes events from a domain model on a STOMP destination.
     *
     * Messages take these forms:
     * <h4>Insert event</h4>
     * <pre>
     * {
     *   "$op": "i",
     *   "$o": { // content of the inserted document
     *     "_id": "54482ad06f6b8cb16959a950",
     *     "name": "My Document",
     *     ...
     *   }
     * }
     * </pre>
     * <h4>Change event</h4>
     * <pre>
     * {
     *   "$op": "u",
     *   "$o": { // document's unique ID
     *     "_id": "54482ad06f6b8cb16959a950"
     *   },
     *   "o2": { // actual update that was made to the document
     *     "name": "New Document Name"
     *   }
     * }
     * </pre>
     * <h4>Delete event</h4>
     * <pre>
     * {
     *   "$op": "d",
     *   "$o": { // document's unique ID
     *     "_id": "54482ad06f6b8cb16959a950"
     *   }
     * }
     * </pre>
     *
     * The "query" parameter supports a special syntax to bind resource path variables to query
     * fields. See the second example below for more info.
     *
     * Supported options: <ul>
     * <li><strong>key</strong> {string} - Field on the document to use as a primary key. Defaults
     *    to "_id".</li>
     * <li><strong>allowIndex</strong> {boolean} - Allow subscriptions to the index, i.e. when no
     *    primary key is specified. Defaults to true.</li>
     * <li><strong>allowSingle</strong> {boolean} - Allow subscriptions to single documents, i.e.
     *    when a primary key is specified. Defaults to true.</li>
     * </ul>
     *
     *
     * @example
     * var resource = new WaterlineResource(domainService.Node);
     * registry.register('/nodes', resource);
     * stompClient.subscribe('/nodes', handleMessage);
     * domainService.Node.create({
     *    name: 'My Node'
     * }).then(function (node) {
     *    node.name = 'Node Name Updated';
     *    return node.savePromised();
     * }).then(function (node) {
     *    return node.removePromised();
     * });
     *
     * function handleMessage(message) {
     *    if (message.body.$op === 'i') {
     *      assert(message.body.$o.name === 'My Node');
     *    } else if (message.body.$op === 'u') {
     *      assert(message.body.$o.name === 'Node Name Updated');
     *    } else if (message.body.$op === 'd') {
     *      console.log('deleted!');
     *    }
     * }
     *
     * @example
     * // binds the "nodeId" path variable to the "node" field in the DB query.
     * var resource = new WaterlineResource(domainService.Workflow, {
     *   node: '$:nodeId'
     * });
     * registry.register('/nodes/:nodeId/workflows', resource);
     *
     * @class WaterlineResource
     * @extends BaseResource
     * @param {Waterline.Collection} collection Waterline collection to listen on.
     * @param {object} [query] Query to filter documents by.
     * @param {object} [options] Options hash
     *
     * @see {@link BaseModel#subscribe}
     */

    function WaterlineResource(deferred, query, options) {
        BaseResource.call(this);

        var collection = waterline.constructor.getCollectionFromDeferred(deferred);
        query = waterline.constructor.getQueryFromDeferred(deferred) || query || {};

        assert.object(collection, 'collection');
        assert.string(collection.identity, 'collection.identity');
        assert.string(collection.primaryKey, 'collection.primaryKey');
        assert.func(collection.findSinceLastUpdate, 'collection.findSinceLastUpdate');

        options = typeof options === 'object' ? options : {};
        options.keyParam = options.keyParam ||
            (lowercaseFirstChar(depluralize(collection.identity)) + 'Id');
        options.key = options.key || collection.primaryKey;
        if (options.allowIndex === undefined) {
            options.allowIndex = true;
        }
        if (options.allowSingle === undefined) {
            options.allowSingle = true;
        }
        if (options.allowLastUpdated === undefined) {
            options.allowLastUpdated = true;
        }
        var path = '/';
        if (options.allowSingle) {
            path += ':' + options.keyParam;
        }

        Object.defineProperties(this, {
            collection: {
                value: collection,
                enumerable: true
            },
            query: {
                value: query,
                enumerable: true
            },
            options: {
                value: options
            },
            path: {
                value: path, enumerable: true
            },
            _modelSubscriptions: {
                value: new Map()
            }
        });
    }

    function depluralize(str) {
        if (str[str.length - 1] === 's') {
            return str.substring(0, str.length - 1);
        }
        return str;
    }

    function lowercaseFirstChar(str) {
        if (typeof str !== 'string' || !str.length) {
            return '';
        }
        return str[0].toLowerCase() + str.substring(1);
    }


    WaterlineResource.prototype.subscribe = function subscribe(subscription) {
        var self = this;
        BaseResource.prototype.subscribe.call(self, subscription);

        var query = _.cloneDeep(self.query);
        query = self.generateDatabaseQuery(subscription, query);

        var modelSubscription = waterline.observe(self.collection, query)
        .subscribe(self._handleMessage.bind(self, subscription));
        self._modelSubscriptions.set(subscription, modelSubscription);
        subscription.on('unsubscribe', function () {
            self._modelSubscriptions.delete(subscription);
            modelSubscription.dispose();
        });

        if (self.options.allowLastUpdated) {
            var lastUpdated = new Date(subscription.headers[LAST_UPDATED_HEADER]);
            if (!isNaN(lastUpdated)) {
                return self.collection.findSinceLastUpdate(lastUpdated, query)
                .then(self._handleFillResults.bind(self, subscription, lastUpdated));
            }
        }
        return Q.resolve();
    };

    WaterlineResource.prototype._handleFillResults =
        function handleFillResults(subscription, lastUpdated, results) {
        var self = this;
        results.forEach(function (doc) {
            if (doc.createdAt > lastUpdated) {
                self._receiveCreated(subscription, doc);
            } else {
                self._receiveUpdated(subscription, doc);
            }
        });
        subscription.flush();
    };

    WaterlineResource.prototype.generateDatabaseQuery =
        function generateDatabaseQuery(subscription, query) {
        // special query operator we implement to denote that
        // the value should be taken from a subscription param
        var MAGIC_TOKEN = '$:';
        var self = this;
        var params = subscription.mapping.params;
        var options = self.options;
        function setParams(param, field, queryObj) {
            if (typeof param === 'string') {
                if (param.indexOf(MAGIC_TOKEN) === 0) {
                    var paramName = param.substr(MAGIC_TOKEN.length);
                    if (params[paramName] === undefined) {
                        throw new Error(['Invalid param name "',
                                        param,
                                        '" in query: ',
                                        JSON.stringify(query)]
                                        .join(''));
                    }
                    queryObj[field] = params[paramName];
                }
            } else if (param && typeof param === 'object') {
                _.forEach(param, setParams);
            }
        }
        setParams(query);

        if (params[options.keyParam]) {
            if (options.allowSingle) {
                query[options.key] = params[options.keyParam];
            } else {
                throw ServerFrame.ERROR(
                    'access denied',
                    'subscribing to single documents is not allowed for destination: ' +
                        subscription.mapping.path,
                    { status: 403 });
            }
        } else if (!options.allowIndex) {
            throw ServerFrame.ERROR(
                'access denied',
                'subscribing to document index is not allowed for destination: ' +
                    subscription.mapping.path,
                { status: 403 });
        }
        return query;
    };

    WaterlineResource.prototype._handleMessage = function handleMessage(subscription, message) {
        var self = this;
        if (message.event === 'created') {
            self._receiveCreated(subscription, message.record);
        } else if (message.event === 'updated') {
            self._receiveUpdated(subscription, message.record);
        } else if (message.event === 'destroyed') {
            self._receiveDestroyed(subscription, message.record);
        }
        subscription.flush();
    };

    WaterlineResource.prototype._receiveCreated = function receiveCreated(subscription, doc) {
        subscription.send({
            $o: doc,
            $op: 'i'
        });
    };

    WaterlineResource.prototype._receiveUpdated = function receiveUpdated(subscription, doc) {
        var self = this;
        var key = self.options.key;
        subscription.send({
            $o: _.pick(doc, key),
            $o2: _.omit(doc, key),
            $op: 'u'
        });
    };

    WaterlineResource.prototype._receiveDestroyed = function receiveDestroyed(subscription, doc) {
        subscription.send({
            $o: doc,
            $op: 'd'
        });
    };


    return WaterlineResource;
}

