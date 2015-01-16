// Copyright 2015, Renasar Technologies Inc.
/* jshint node: true */

'use strict';

var di = require('di');

module.exports = StompServiceFactory;

di.annotate(StompServiceFactory, new di.Provide('stomp'));
di.annotate(StompServiceFactory,
    new di.Inject(
        'Services.Configuration',
        'Logger',
        'MQ'
    )
);


function StompServiceFactory(configuration, Logger, MQ) {
    function noop() {}

    var logger = Logger.initialize(StompServiceFactory);
    logger.debug = noop;
    logger.silly = noop;
    var logFunc = console.log.bind(console);

    if (configuration.get('stompLogLevel') === 'debug') {
        logger.debug = logFunc;
    } else if (configuration.get('stompLogLevel') === 'silly') {
        logger.debug = logFunc;
        logger.silly = logFunc;
    }
    var stomp = MQ.createServer({
      logger: logger,
      identifier: configuration.get('stompIdentifier')
    });
    return stomp;
}
