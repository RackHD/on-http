// Copyright 2015, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

describe('stomp', function () {
    beforeEach(function() {
        // use helper.setupInjector because we don't want to start core services
        helper.setupInjector(_.flatten([
            helper.require('/lib/services/stomp-service.js'),
            dihelper.simpleWrapper(require('renasar-mq'), 'MQ')
        ]));
    });


    it('should initialize', function () {
        helper.injector.get('stomp');
    });
});
