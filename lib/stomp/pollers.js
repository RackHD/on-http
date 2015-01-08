/*
 * Copyright 2014, Renasar Technologies Inc.
 * Created by jfg on 11/10/14.
 */
/* jshint node: true */

'use strict';

var di = require('di');

module.exports = PollersResourceFactory;

di.annotate(PollersResourceFactory,
    new di.Inject(
        'Services.Waterline',
        'Stomp.DomainModelResource'
    )
);

function PollersResourceFactory(
  waterline,
  DomainModelResource) {

    var pollers = new DomainModelResource(waterline.pollers);

    return pollers;
}

