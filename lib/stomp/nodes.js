/*
 * Copyright 2014-2015, Renasar Technologies Inc.
 * Created by jfg on 11/10/14.
 */
/* jshint node: true */

'use strict';

var di = require('di');

module.exports = NodesResourceFactory;

di.annotate(NodesResourceFactory,
    new di.Inject(
        'Services.Waterline',
        'Stomp.WaterlineResource'
    )
);

function NodesResourceFactory(waterline, WaterlineResource) {
    var nodes = new WaterlineResource(waterline.nodes);

    nodes
        .addChild('catalogs', new WaterlineResource(waterline.catalogs, {
          node: '$:nodeId'
        }));

    return nodes;
}
