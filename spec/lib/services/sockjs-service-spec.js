// Copyright 2015, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

var fs = require('fs');

describe('SockJS.Server', function () {
    helper.before(function() {
        return _.flatten([
            helper.require('/lib/services/sockjs-service.js'),
            helper.require('/lib/services/stomp-service.js'),
            dihelper.simpleWrapper(require('renasar-mq'), 'MQ')
        ]);
    });

    helper.after();

    it('should attach stomp to an http server', function () {
        var server = helper.injector.get('SockJS.Server');
        server.listen(require('http').createServer());
    });

    it('should attach stomp to an https server', function () {
        var server = helper.injector.get('SockJS.Server');
        server.listen(require('https').createServer({
            cert: fs.readFileSync('data/dev-cert.pem'),
            key: fs.readFileSync('data/dev-key.pem')
        }));
    });

    it('should attach stomp to a TCP socket', function () {
        var server = helper.injector.get('SockJS.Server');
        server.listen(require('net').createServer({ allowHalfOpen: true }));
    });
});

