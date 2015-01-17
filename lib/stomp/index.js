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
 * @api {subscribe} /nodes/:nodeId/workflows SUBSCRIBE /nodes/:nodeId/workflows
 * @apiGroup websocket
 * @apiDescription Subscribe to a single node's workflows.
 * @apiName node-workflows
 */

/**
 * @api {subscribe} /nodes/:nodeId/workflows/current SUBSCRIBE /nodes/:nodeId/workflows/current
 * @apiGroup websocket
 * @apiDescription Subscribe to a single node's workflow updates.
 * @apiName node-workflows-current
 */

/**
 * @api {subscribe} /nodes/:nodeId/catalogs SUBSCRIBE /nodes/:nodeId/catalogs
 * @apiGroup websocket
 * @apiDescription Subscribe to a single node's catalogs.
 * @apiName node-catalogs-subscribe
 */

/**
 * @api {subscribe} /nodes/:nodeId/logs SUBSCRIBE /nodes/:nodeId/logs
 * @apiGroup websocket
 * @apiDescription Subscribe to a single node's logging events.
 * @apiParam {Number} replay Number of past log events to replay upon subscribe
 * @apiName node-logs-subscribe
 */

/**
 * @api {subscribe} /nodes/:nodeId/syslog SUBSCRIBE /nodes/:nodeId/syslog
 * @apiGroup websocket
 * @apiDescription Subscribe to a single node's syslog events.
 * @apiName node-syslog-subscribe
 */

/**
 * @api {subscribe} /workflows SUBSCRIBE /workflows
 * @apiGroup websocket
 * @apiDescription Subscribe to all workflows.
 * @apiName workflows-subscribe
 */

/**
 * @api {subscribe} /workflows/:workflowId SUBSCRIBE /workflows/:workflowId
 * @apiGroup websocket
 * @apiDescription Subscribe to a single workflow.
 * @apiName workflow-subscribe
 */

/**
 * @api {subscribe} /workflows/:workflowId/events SUBSCRIBE /workflows/:workflowId/events
 * @apiGroup websocket
 * @apiDescription Subscribe to a single workflow's events.
 * @apiName workflow-events-subscribe
 */

/**
 * @api {subscribe} /pollers SUBSCRIBE /pollers
 * @apiGroup websocket
 * @apiDescription Subscribe to all pollers.
 * @apiName pollers-subscribe
 */

/**
 * @api {subscribe} /pollers/:pollerId SUBSCRIBE /pollers/:pollerId
 * @apiGroup websocket
 * @apiDescription Subscribe to a single poller.
 * @apiName poller-subscribe
 */

/**
 * @api {subscribe} /logging SUBSCRIBE /logging
 * @apiGroup websocket
 * @apiDescription Subscribe to all internal log events
 * @apiName logging-subscribe
 *
 * <h4>Sample logging event</h4>
 *
 * logging messages follow the same higher level format of other
 * websocket messages, with an $op value of 'i' and some additional
 * field conventions.
 *
 * <pre class="prettyprint language-json prettyprinted" data-type="js">
 * {<br>
 *   "channel":"logging",<br>
 *   "topic":"logging.silly",<br>
 *   "timeStamp":"2014-12-05T18:40:48.573Z",<br>
 *   "$op":"i",<br>
 *   "$o":{<br>
 *     "level":"silly",<br>
 *     "timestamp":"2014-12-05T18:40:48.572Z",<br>
 *     "message":"Removing Workflow Instance.",<br>
 *     "meta":{<br>
 *       "node":"5474f806c901d8004d7608f4",<br>
 *       "instance":"c9fc3ad7-b827-4905-bb4f-3ff12d4d2be7",<br>
 *       "state":"completed"<br>
 *     }<br>
 *   }<br>
 * }<br>
 * </pre>
 *
 * <ul>
 * <li>body.channel - overall AMQP channel, string</li>
 * <li>body.topic - subdivision of channel, string</li>
 * <li>body.timestamp - timestamp internal to system when generated</li>
 * <li>body.$op - always "i" to overlay/match with data model update concepts</li>
 * <li>body.$o - structured content of message</li>
 * <li>body.$o.$timestamp - timestamp forwarded to STOMP</li>
 * <li>body.$o.level - log level (syslog style levels)</li>
 * <li>body.$o.message - free-form human readable string message</li>
 * <li>body.$o.meta - data object associated with log message - internal data structures</li>
 * </ul>
 *
 */

'use strict';

var di = require('di');
var factories = {
//  nodes: require('./nodes'),
};

module.exports = CommonStompResources;

di.annotate(CommonStompResources, new di.Provide('common-stomp-resources'));
di.annotate(CommonStompResources,
    new di.Inject(
        di.Injector
    )
);

function CommonStompResources(
  injector) {

    Object.defineProperties(this, {
        injector: { value: injector },
        resources: { value: null, writable: true }
    });
}

CommonStompResources.prototype.register = function register(stomp) {
    var self = this;

    if (self.resources) {
        throw new Error('already started!');
    }

    //var nodes = self.injector.get(factories.nodes);

    self.resources = {
        //nodes: nodes,
    };

    stomp.registry.register(self.resources);
};

CommonStompResources.prototype.unregister = function unregister(stomp) {
    var self = this;
    if (self.resources) {
        //stomp.unregister(self.resources.nodes);
        self.resources = null;
    }
};

