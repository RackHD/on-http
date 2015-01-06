// Copyright 2014, Renasar Technologies Inc.
/* jshint: node:true */

'use strict';

var di = require('di'),
    core = require('renasar-core')(di),
    injector = new di.Injector(
        core.injectables
    ),
    logger = injector.get('Logger').initialize('Server.Http'),
    lookup = injector.get('Services.Lookup'),
    waterline = injector.get('Services.Waterline');

waterline.start().then(function () {
    logger.info('Hello Http');

    lookup.macAddressToNode('00-11-22-33-44-55').then(function (node) {
        console.log(node);
    }).fail(function (error) {
        console.log(error);
    });
}).fail(function (error) {
    logger.error(error);
});