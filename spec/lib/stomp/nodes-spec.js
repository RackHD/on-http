// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

var di = require('di');

describe(__filename, function () {
    var server;
    var nodes;
    var injector;

    beforeEach(function() {
        injector = new di.Injector(_.flatten([
            core.injectables,
            helper.require('/lib/stomp/waterline-resource.js'),
            dihelper.simpleWrapper(require('renasar-mq'), 'MQ')
        ]));
        return helper.initializeWaterline(injector).then(function () {
            nodes = injector.get(helper.require('/lib/stomp/nodes.js'));
            server = injector.get('MQ').createServer();
        });
    });

    afterEach(function () {
        return helper.closeWaterline(injector);
    });

    it('should register', function () {
        server.registry.register(nodes);
    });

    it('should have a catalogs resource', function () {
        expect(nodes.children.catalogs).to.be.ok;
    });

    // TODO - integration testing with a STOMP client
});
