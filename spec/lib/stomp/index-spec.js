// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

var di = require('di');

describe(__filename, function () {
    var server;
    var resources;
    var injector;

    beforeEach(function() {
        injector = new di.Injector(_.flatten([
            core.injectables,
            helper.require('/lib/stomp/waterline-resource.js'),
            helper.require('/lib/stomp/index.js'),
            dihelper.simpleWrapper(require('renasar-mq'), 'MQ')
        ]));
        return helper.initializeWaterline(injector).then(function () {
            resources = injector.get('common-stomp-resources');
            server = injector.get('MQ').createServer();
        });
    });

    afterEach(function () {
        return helper.closeWaterline(injector);
    });

    it('should register and unregister', function () {
        resources.register(server);
        resources.unregister(server);
    });
});
