// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

describe('Http.Server', function () {
    var sockJs = {};
    var app = require('express')();
    var server;

    before(function() {
        // use helper.setupInjector because we don't want to start core services
        helper.setupInjector(_.flatten([
            helper.require('/lib/services/http-service.js'),
            dihelper.simpleWrapper(sockJs, 'SockJS.Server'),
            dihelper.simpleWrapper(app, 'express-app', undefined, __dirname),
        ]));

        sockJs.listen = sinon.stub();
        server = helper.injector.get('Http.Server');
    });

    it('should listen on HTTP port and start the websocket listener', function () {
        // can't use port 80 because it requires setuid root
        server.listen(8089);
        expect(sockJs.listen).to.have.been.calledOnce;
        server.close();
    });

});
