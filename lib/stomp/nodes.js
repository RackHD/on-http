/*
 * Copyright 2014, Renasar Technologies Inc.
 * Created by jfg on 11/10/14.
 */
/* jshint node: true */

'use strict';

var di = require('di');
var util = require('util');

module.exports = NodesResourceFactory;

di.annotate(NodesResourceFactory,
    new di.Inject(
        'lodash',
        'constants',
        'workflow-manager',
        'Services.Waterline',
        'log-forwarding-service',
        'Stomp.DomainModelResource',
        'Stomp.PostalResource'
    )
);

function NodesResourceFactory(
  _,
  constants,
  workflowService,
  waterline,
  logForwardingService,
  DomainModelResource,
  PostalResource) {

    util.inherits(CurrentWorkflowResource, PostalResource);
    function CurrentWorkflowResource(options) {
      PostalResource.call(this, options);
    }
    CurrentWorkflowResource.prototype.envelopeToMessage =
      function envelopeToMessage(envelope) {
      var record = envelope.data;
      if (workflowService.isStandaloneWorkflow(record.name)) {
        return waterline.workflows
        .findByIdentifier(record.id)
        .populate('workflows')
        .then(function workflowToMessage(workflow) {
          return {
            $op: 'u',
            $o: {},
            $o2: workflow
          };
        });
      }
    };

    util.inherits(LoggingResource, PostalResource);
    function LoggingResource(options) {
      PostalResource.call(this, options);
    }
    LoggingResource.prototype.subscribe = function subscribe(subscription) {
        var replay = parseInt(subscription.mapping.query.replay, 10);
        if (replay > 0) {
            var nodeId = subscription.mapping.params.nodeId;
            var entries = logForwardingService.peekNodeCacheSync(nodeId);
            if (entries.length > 0) {
                entries.slice(-replay).forEach(function (entry) {
                   subscription.send(_.extend(_.omit(entry, 'data'), {
                      $op: 'i',
                      $o: entry.data
                  }));
                });
                subscription.flush();
            }
        }
        PostalResource.prototype.subscribe.call(this, subscription);
    };

    var nodes = new DomainModelResource(waterline.nodes);

    nodes
        .addChild('workflows', new DomainModelResource(waterline.workflows, {
          node: '$:nodeId',
          type: constants.PARENT_WORKFLOW_TYPE
        }, {
          allowSingle: false
        })
            .addChild('current', new CurrentWorkflowResource({
                channelParam: 'nodeId',
                topic: constants.WORKFLOW_PROGRESS_TOPIC
            })))
        .addChild('catalogs', new DomainModelResource(waterline.catalogs, {
          node: '$:nodeId'
        }))
        .addChild('logs', new LoggingResource({
            channelParam: 'nodeId',
            topic: constants.LOGGER_EVENT_WILDCARD
        }))
        .addChild('syslog', new PostalResource({
            channelParam: 'nodeId',
            topic: constants.SYSLOG_EVENT_TOPIC
        }));

    return nodes;
}
