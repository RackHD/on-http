// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node:true */

'use strict';


describe('STOMP /nodes', function () {
    var server;
    var nodes;

    helper.before(function() {
        return _.flatten([
            helper.require('/lib/stomp/waterline-resource.js'),
            dihelper.simpleWrapper(require('renasar-mq'), 'MQ')
        ]);
    });

    before(function () {
        nodes = helper.injector.get(helper.require('/lib/stomp/nodes.js'));
        server = helper.injector.get('MQ').createServer();
    });

    helper.after();

    it('should register', function () {
        server.registry.register(nodes);
    });

    it('should have a catalogs resource', function () {
        expect(nodes.children.catalogs).to.be.ok;
    });

    // TODO - integration testing with a STOMP client
});
