/*
 * Copyright 2014-2015, Renasar Technologies Inc.
 * Created by jfg on 10/14/14.
 */
/* jshint node: true */

/**
 * @api {subscribe} /nodes SUBSCRIBE /nodes
 * @apiGroup websocket
 * @apiGroupDescription
 * Using the websocket API requires a STOMP connection over SockJS to the
 * URL "/sockjs_stomp".
 *
 * <h3>Message Specification</h3>
 * javascript STOMP includes a top-level structure for all messages running
 * over its * transport.
 *
 * <pre class="prettyprint language-json prettyprinted" data-type="js">
 * {<br>
 *   command: 'MESSAGE',<br>
 *   headers: {<br>
 *     'content-length': '85'<br>
 *     'message-id': 'fb425e01-7cab-11e4-8ff1-47e5440a59a8',<br>
 *     subscription: 'sub-0',<br>
 *     destination: '/nodes/',<br>
 *     'content-type': 'application/json' },<br>
 *   body: '...'<br>
 * }<br>
 * </pre>
 *
 * The body of this message is a JSON parsable string that translates to a
 * javascript object. All websocket messages contain the following fields:
 *
 * <ul>
 * <li><strong>$op</strong> -
 *  A single-letter string representing the event type. Can be one of three
 *  values:
 * <ul>
 * <li><strong>i</strong> - Document inserted</li>
 * <li><strong>u</strong> - Document updated</li>
 * <li><strong>d</strong> - Document deleted</li>
 * </ul>
 * </li>
 * <li><strong>$o</strong> - Object representing the document.
 * </ul>
 *
 * <h4>Sample Inserted Event</h4>
 *
 * <pre class="prettyprint language-json prettyprinted" data-type="js">
 * {<br>
 *   "$op": "i",<br>
 *   "$o": {<br>
 *     "id": "5446da43c18be1348df963b7",<br>
 *     "name": "My Document"<br>
 *   }<br>
 * }<br>
 * </pre>
 *
 * The "$o" will always have at least an "id" field present that can and
 * should be used to uniquely identify the document. An inserted event will
 * contain any additional fields present on the document at the time of insert
 * in the "$o" object.
 *
 * <h4>Sample Updated Event</h4>
 *
 * <pre class="prettyprint language-json prettyprinted" data-type="js">
 * {<br>
 *   "$op": "u",<br>
 *   "$o": {<br>
 *     "id": "5446da43c18be1348df963b7"<br>
 *   },<br>
 *   "$o2": {<br>
 *     "name": "Another Document"<br>
 *   }<br>
 * }<br>
 * </pre>
 *
 * An updated event will have an additional "$o2" field that contains the
 * fields that were updated. These values should be set over any existing
 * values in the document to update it.
 *
 * <h4>Sample Deleted Event</h4>
 *
 * <pre class="prettyprint language-json prettyprinted" data-type="js">
 * {<br>
 *   "$op": "d",<br>
 *   "$o": {<br>
 *     "id": "5446da43c18be1348df963b7"<br>
 *   },<br>
 * }<br>
 * </pre>
 *
 * A deleted event signals that clients should remove the object from their
 * cache/storage. It will only contain an "id" field in the "$o" object.
 *
 * <h3>Usage</h3>
 *
 * Sample usage from a browser with the SockJS and STOMP libraries:
 *
 * <pre class="prettyprint language-json prettyprinted" data-type="js">
 * &lt;script src="//cdnjs.cloudflare.com/ajax/libs/sockjs-client/0.3.4/sockjs.min.js"&gt;
 * &lt;/script&gt;<br>
 * &lt;script src="//cdnjs.cloudflare.com/ajax/libs/stomp.js/2.3.3/stomp.min.js"&gt;
 * &lt;/script&gt;<br>
 * &lt;script type="text/javascript"&gt;<br>
 * var url = 'http://localhost/sockjs_stomp';<br>
 * var ws = new SockJS(url);<br>
 * var client = Stomp.over(ws);<br>
 * client.connect({ host: 'localhost' }, function () {<br>
 *   console.log('client connected!');<br>
 * }, function (error) {<br>
 *   console.error('client error: ' + error);<br>
 * });<br>
 * &lt;/script&gt;
 * </pre>
 *
 * See the sockjs-client and stomp-websocket documentation for more info on
 * how to use these libraries:
 *
 * https://github.com/sockjs/sockjs-client<br>
 * http://jmesnil.net/stomp-websocket/doc/#alternative
 *
 * @apiDescription Subscribe to all nodes.
 * @apiName nodes-subscribe
 * @apiExample {js} Example usage:
 *  client.subscribe('/nodes', function (message) {
 *    var body = message.body;
 *    if (body.$op === 'i') {
 *      console.log('node inserted: ' + body.$o);
 *    }
 *  });
 *
 */

/**
 * @api {subscribe} /nodes/:nodeId SUBSCRIBE /nodes/:nodeId
 * @apiGroup websocket
 * @apiDescription Subscribe to a single node.
 * @apiName node-subscribe
 */

/**
 * @api {subscribe} /nodes/:nodeId/catalogs SUBSCRIBE /nodes/:nodeId/catalogs
 * @apiGroup websocket
 * @apiDescription Subscribe to a single node's catalogs.
 * @apiName node-catalogs-subscribe
 */

'use strict';

var di = require('di');
var factories = {
    nodes: require('./nodes'),
};

module.exports = CommonStompResources;

di.annotate(CommonStompResources, new di.Provide('common-stomp-resources'));
di.annotate(CommonStompResources,
    new di.Inject(
        'Assert',
        di.Injector
    )
);

function CommonStompResources(assert, injector) {

    Object.defineProperties(this, {
        assert: {
            value: assert
        },
        injector: {
            value: injector
        },
        resources: {
            value: null,
            writable: true
        }
    });
}

CommonStompResources.prototype.register = function register(stomp) {
    var self = this;

    self.assert.ok(!self.resources, "resources already registered");

    self.resources = {
        nodes: self.injector.get(factories.nodes),
    };

    stomp.registry.register(self.resources);
};

CommonStompResources.prototype.unregister = function unregister(stomp) {
    var self = this;

    self.assert.ok(self.resources, "resources not registered");

    stomp.registry.unregister(self.resources.nodes);
    self.resources = null;
};

