// Copyright 2014, Renasar Technologies Inc.
/* jshint: node:true */

var di = require('di'),
    core = require('renasar-core')(di),
    injector = new di.Injector(
        core.injectables
    ),
    logger = injector.get('Logger').initialize('SysLog');

logger.info('Hello Http');