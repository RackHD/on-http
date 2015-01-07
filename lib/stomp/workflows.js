/*
 * Copyright 2014, Renasar Technologies Inc.
 * Created by jfg on 11/10/14.
 */
/* jshint node: true */

'use strict';

var di = require('di');

module.exports = WorkflowsResourceFactory;

di.annotate(WorkflowsResourceFactory,
    new di.Inject(
        'Services.Waterline',
        'Stomp.DomainModelResource'
    )
);

function WorkflowsResourceFactory(
  waterline,
  DomainModelResource) {

    var workflows = new DomainModelResource(waterline.workflows);

    workflows
        .addChild('events', new DomainModelResource(waterline.workflowevents, {
            workflow: '$:workflowId'
        }));

    return workflows;
}

