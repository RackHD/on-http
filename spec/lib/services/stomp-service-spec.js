// Copyright 2015, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

var _ = require('lodash');

describe(__filename, function () {
    var injector;
    beforeEach(function() {
        injector = helper.baseInjector.createChild(_.flatten([
            helper.require('/lib/services/stomp-service.js'),
            dihelper.simpleWrapper(require('renasar-mq'), 'MQ')
        ]));
    });


    it('should initialize', function () {
        injector.get('stomp');
    });
});
