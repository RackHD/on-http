// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

describe('common-stomp-resources', function () {
    var server;
    var resources;

    helper.before(function() {
        return _.flatten([
            helper.require('/lib/stomp/waterline-resource.js'),
            helper.require('/lib/stomp/index.js'),
            dihelper.simpleWrapper(require('on-mq'), 'MQ')
        ]);
    });

    before(function () {
        resources = helper.injector.get('common-stomp-resources');
        server = helper.injector.get('MQ').createServer();
    });

    helper.after();

    it('should register and unregister', function () {
        resources.register(server);
        resources.unregister(server);
    });
});
