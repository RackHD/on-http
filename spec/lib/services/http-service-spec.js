// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

describe('Http.Server', function () {
    var sockJs = {};
    var app;
    var server;

    before('create express app', function () {
        app = require('express')();
        app.use('/test', function (req, res) {
            res.send('Hello World!');
        });
    });

    before('set up test dependencies', function() {
        // use helper.setupInjector because we don't want to start core services
        helper.setupInjector(_.flatten([
            helper.require('/lib/services/http-service.js'),
            dihelper.simpleWrapper(app, 'express-app', undefined, __dirname),
        ]));

        server = helper.injector.get('Http.Server');
    });

    before('allow self signed certs', function () {
       process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    });

    after('disallow self signed certs', function () {
       process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';
    });

    describe('http', function () {
        before('set up mocks', function () {
            sockJs.listen = sinon.stub();
        });

        before('listen', function () {
            helper.injector.get('Services.Configuration')
                .set('httpEnabled', true)
                .set('httpsEnabled', false)
            // can't use port 80 because it requires setuid root
                .set('httpBindPort', 8089);
            server.listen();
        });

        it('should respond to requests', function () {
            return helper.request('http://localhost:8089')
            .get('/test')
            .expect(200)
            .expect('Hello World!');
        });

        after('close', function () {
            server.close();
        });
    });

    describe('https', function () {
        before('set up mocks', function () {
            sockJs.listen = sinon.stub();
        });

        before('listen', function () {
            helper.injector.get('Services.Configuration')
                .set('httpEnabled', false)
                .set('httpsEnabled', true)
                .set('httpsCert', 'data/dev-cert.pem')
                .set('httpsKey', 'data/dev-key.pem')
            // can't use port 443 because it requires setuid root
                .set('httpsBindPort', 8443);
            server.listen();
        });

        it('should respond to requests', function () {
            return helper.request('https://localhost:8443')
            .get('/test')
            .expect(200)
            .expect('Hello World!');
        });

        after('close', function () {
            server.close();
        });
    });

    describe('https with pfx', function () {
        before('set up mocks', function () {
            sockJs.listen = sinon.stub();
        });

        before('listen', function () {
            helper.injector.get('Services.Configuration')
                .set('httpEnabled', false)
                .set('httpsEnabled', true)
                .set('httpsPfx', 'data/dev.pfx')
            // can't use port 443 because it requires setuid root
                .set('httpsBindPort', 8444);
            server.listen();
        });

        it('should respond to requests', function () {
            return helper.request('https://localhost:8444')
            .get('/test')
            .expect(200)
            .expect('Hello World!');
        });

        after('close', function () {
            server.close();
        });
    });

    it('should throw an error if http and https are both disabled', function () {
        helper.injector.get('Services.Configuration')
        .set('httpEnabled', false)
        .set('httpsEnabled', false);

        expect(function () {
            server.listen();
        }).to.throw(Error);
    });
});
