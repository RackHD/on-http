// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Auth.Service', function () {
    var server;
    var sandbox = sinon.sandbox.create();
    var jwtStrategy = require('passport-jwt').Strategy;

    var SUCCESS_STATUS = 200;
    var UNAUTHORIZED_STATUS = 401;
    var ERROR_STATUS = 500;


    var token = '';
    var endpoint = {
        "address": "0.0.0.0",
        "port": 9443,
        "httpsEnabled": true,
        "httpsCert": "data/dev-cert.pem",
        "httpsKey": "data/dev-key.pem",
        "httpsPfx": null,
        "proxiesEnabled": false,
        "authEnabled": true,
        "routers": "northbound-api-router"
    };

    function startServer(endpoint){
        var Server = helper.injector.get('Http.Server');
        server = new Server(endpoint);
        return server.start();
    }

    function cleanUp(){
        return server.stop()
            .then(function(){
                sandbox.restore();
                return restoreConfig();
            }
        );
    }

    function setConfig(){
        return helper.injector.get('Services.Configuration')
            .set('authPasswordHash', 'KcBN9YobNV0wdux8h0fKNqi4uoKCgGl/j8c6Y' +
            'GlG7iA0PB3P9ojbmANGhDlcSBE0iOTIsYsGbtSsbqP4wvsVcw==')
            .set('authPasswordSalt', 'zlxkgxjvcFwm0M8sWaGojh25qNYO8tuNWUMN4' +
            'xKPH93PidwkCAvaX2JItLA3p7BSCWIzkw4GwWuezoMvKf3UXg==')
            .set('authTokenExpireIn', 86400);
    }

    function restoreConfig(){
        return helper.injector.get('Services.Configuration')
            .set('authPasswordHash', 'KcBN9YobNV0wdux8h0fKNqi4uoKCgGl/j8c6' +
            'YGlG7iA0PB3P9ojbmANGhDlcSBE0iOTIsYsGbtSsbqP4wvsVcw==')
            .set('authPasswordSalt', 'zlxkgxjvcFwm0M8sWaGojh25qNYO8tuNWUMN' +
            '4xKPH93PidwkCAvaX2JItLA3p7BSCWIzkw4GwWuezoMvKf3UXg==')
            .set('authTokenExpireIn', 86400);
    }

    helper.before(function () {
        return [
            dihelper.simpleWrapper(require('swagger-express-mw'), 'swagger'),
            dihelper.simpleWrapper({}, 'TaskGraph.TaskGraph'),
            dihelper.simpleWrapper({}, 'TaskGraph.Store'),
            dihelper.simpleWrapper({}, 'Task.Services.OBM'),
            dihelper.simpleWrapper({}, 'ipmi-obm-service'),
            dihelper.requireWrapper('rimraf', 'rimraf', undefined, __dirname),
            dihelper.requireWrapper('os-tmpdir', 'osTmpdir', undefined, __dirname),
            helper.require('/lib/services/http-service'),
            helper.requireGlob('/lib/api/login/*.js'),
            helper.requireGlob('/lib/api/1.1/**/*.js'),
            helper.requireGlob('/lib/services/**/*.js'),
            helper.requireGlob('/lib/serializables/**/*.js')
        ];
    });

    before('allow self signed certs', function () {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    });

    helper.after();

    after('disallow self signed certs', function () {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';
    });

    var waterline;
    before('setup default admin user', function() {
        waterline = helper.injector.get('Services.Waterline');
        waterline.localusers = {
            findOne: sinon.stub()
        };
        waterline.localusers.findOne.withArgs({username: 'admin'}).resolves({
            username: 'admin',
            comparePassword: function(password) { return password === 'admin123'; }
        });
        waterline.localusers.findOne.resolves();

        //Override the ES6-Thim Promise with Bluebird Promise from DI
        //Promise.delay is only valid on bluebird Promise
        Promise = helper.injector.get('Promise');
    });

    after('remove waterline definition', function() {
        delete waterline.localusers;
    });

    describe('Auth.Service', function () {
        before('start http and https server with auth enabled', function () {
            setConfig();
            return startServer(endpoint);
        });

        it('should return a token from /login', function () {
            return helper.request('https://localhost:9443')
                .post('/login')
                .send({username: "admin", password: "admin123"})
                .expect(SUCCESS_STATUS)
                .expect(function (res) {
                    expect(res.body.token).to.be.a('string');
                    token = res.body.token;
                });
        });

        it('should able to access with correct token in query string', function () {
            return helper.request('https://localhost:9443')
                .get('/api/1.1/config?auth_token=' + token)
                .expect(SUCCESS_STATUS);
        });

        it('should fail with wrong token in query string', function () {
            return helper.request('https://localhost:9443')
                .get('/api/1.1/config?auth_token=' + token + 'balabalabala')
                .expect(UNAUTHORIZED_STATUS)
                .expect(function (res) {
                    expect(res.body.message).to.be.a('string');
                    expect(res.body.message).to.equal('invalid signature');
                });
        });

        it('should fail with empty token in query string', function () {
            return helper.request('https://localhost:9443')
                .get('/api/1.1/config?auth_token=')
                .expect(UNAUTHORIZED_STATUS)
                .expect(function (res) {
                    expect(res.body.message).to.be.a('string');
                    expect(res.body.message).to.equal('No auth token');
                });
        });

        it('should fail with wrong token key in query string', function () {
            return helper.request('https://localhost:9443')
                .get('/api/1.1/config?auth_tokennnnnnnn=')
                .expect(UNAUTHORIZED_STATUS)
                .expect(function (res) {
                    expect(res.body.message).to.be.a('string');
                    expect(res.body.message).to.equal('No auth token');
                });
        });

        it('should able to access with correct token in query header', function () {
            return helper.request('https://localhost:9443')
                .get('/api/1.1/config')
                .set("authorization", 'JWT ' + token)
                .send()
                .expect(SUCCESS_STATUS);
        });

        it('should fail with wrong token in query header', function () {
            return helper.request('https://localhost:9443')
                .get('/api/1.1/config')
                .set("authorization", 'JWT ' + token + 'balabalabala')
                .send()
                .expect(UNAUTHORIZED_STATUS)
                .expect(function (res) {
                    expect(res.body.message).to.be.a('string');
                    expect(res.body.message).to.equal('invalid signature');
                });
        });

        it('should fail with empty token in query header', function () {
            return helper.request('https://localhost:9443')
                .get('/api/1.1/config')
                .set("authorization", '')
                .send()
                .expect(UNAUTHORIZED_STATUS)
                .expect(function (res) {
                    expect(res.body.message).to.be.a('string');
                    expect(res.body.message).to.equal('No auth token');
                });
        });

        it('should fail with wrong token key in query header', function () {
            return helper.request('https://localhost:9443')
                .get('/api/1.1/config')
                .set("authorization_balabalabala", '')
                .send()
                .expect(UNAUTHORIZED_STATUS)
                .expect(function (res) {
                    expect(res.body.message).to.be.a('string');
                    expect(res.body.message).to.equal('No auth token');
                });
        });

        it('should able to access with correct token in query body', function () {
            return helper.request('https://localhost:9443')
                .get('/api/1.1/config')
                .send({auth_token: token}) /* jshint ignore: line */
                .expect(SUCCESS_STATUS);
        });

        it('should fail with wrong token in query body', function () {
            return helper.request('https://localhost:9443')
                .get('/api/1.1/config')
                .send({auth_token: token + 'balabalabala'}) /* jshint ignore: line */
                .expect(UNAUTHORIZED_STATUS)
                .expect(function (res) {
                    expect(res.body.message).to.be.a('string');
                    expect(res.body.message).to.equal('invalid signature');
                });
        });

        it('should fail with empty token in query body', function () {
            return helper.request('https://localhost:9443')
                .get('/api/1.1/config')
                .send({auth_token: ''}) /* jshint ignore: line */
                .expect(UNAUTHORIZED_STATUS)
                .expect(function (res) {
                    expect(res.body.message).to.be.a('string');
                    expect(res.body.message).to.equal('No auth token');
                });
        });

        it('should fail with wrong token key in query body', function () {
            return helper.request('https://localhost:9443')
                .get('/api/1.1/config')
                .send({auth_tokennnnnnnnn: token}) /* jshint ignore: line */
                .expect(UNAUTHORIZED_STATUS)
                .expect(function (res) {
                    expect(res.body.message).to.be.a('string');
                    expect(res.body.message).to.equal('No auth token');
                });
        });

        it('should fail with no token at all', function () {
            return helper.request('https://localhost:9443')
                .get('/api/1.1/config')
                .expect(UNAUTHORIZED_STATUS)
                .expect(function (res) {
                    expect(res.body.message).to.be.a('string');
                    expect(res.body.message).to.equal('No auth token');
                });
        });

        after('Clean up', function () {
            return cleanUp();
        });
    });

    describe('Should return internal server error with auth error callback', function () {
        before('start HTTPs server', function () {
            sandbox.stub(jwtStrategy.prototype, 'authenticate', function() {
                return this.error('something');
            });
            setConfig();
            return startServer(endpoint);
        });

        it('should fail with auth', function() {
            return helper.request('https://localhost:9443')
                .get('/api/1.1/config?auth_token=' + token)
                .expect(ERROR_STATUS)
                .expect(function(res) {
                    expect(res.body.message).to.be.a('string');
                    expect(res.body.message).to.equal('Internal server error');
                });
        });

        after('stop server, restore mock and configure',function () {
            sandbox.restore();
            return cleanUp();
        });
    });

    describe('Token expiration from config is not a number', function () {
        before('Mock configure settings', function () {
            this.timeout(5000);

            return helper.injector.get('Services.Configuration')
                .set('authTokenExpireIn', 'aaa');
        });

        it('Should throw exception with wrong length of salt from config', function() {
            var authService = helper.injector.get('Auth.Services');
            return expect(function () {
                authService.init();
            }).to.throw(Error);
        });

        after('stop server, restore mock and configure',function () {
            return restoreConfig();
        });
    });

    describe('Token should expire as expected', function () {
        before('start http and https server with auth enabled', function () {
            this.timeout(10000);

            setConfig();
            helper.injector.get('Services.Configuration')
                .set('authTokenExpireIn', 1);
            return startServer(endpoint);
        });

        it('should return a token from /login', function () {
            return helper.request('https://localhost:9443')
                .post('/login')
                .send({username: "admin", password: "admin123"})
                .expect(SUCCESS_STATUS)
                .expect(function(res) {
                    expect(res.body.token).to.be.a('string');
                    token = res.body.token;
                });
        });

        it('Should get token expire error', function() {
            this.timeout(5000);
            return Promise.delay(1000)
                .then(function(){
                    return helper.request('https://localhost:9443')
                        .get('/api/1.1/config?auth_token=' + token)
                        .expect(UNAUTHORIZED_STATUS)
                        .expect(function (res) {
                            expect(res.body.message).to.be.a('string');
                            expect(res.body.message).to.equal('jwt expired');
                        });
                });
        });

        after('stop server, restore mock and configure',function () {
            return cleanUp();
        });
    });

    describe('Token should not expire as expected', function () {
        before('start https server expiration set to 1 second', function () {

            /*
            TODO: https://github.com/RackHD/RackHD/issues/195

            return Promise.resolve().then(function(){
            setConfig();
            helper.injector.get('Services.Configuration')
                .set('authTokenExpireIn', 1);

            return startServer(endpoint)
                .then(function () {
                    return server.stop();
                })
                .then(function () {
                    helper.injector.get('Services.Configuration')
                        .set('authTokenExpireIn', 0);
                    return startServer(endpoint);
                });
            });
            */

            return Promise.resolve().then(function() {
                setConfig();
                helper.injector.get('Services.Configuration')
                    .set('authTokenExpireIn', 0);
                startServer(endpoint);
            });
        });

        it('should return a token from /login', function () {
            return helper.request('https://localhost:9443')
                .post('/login')
                .send({username: "admin", password: "admin123"})
                .expect(SUCCESS_STATUS)
                .expect(function(res) {
                    expect(res.body.token).to.be.a('string');
                    token = res.body.token;
                });
        });

        it('should able to access with correct token in query string', function () {
            return helper.request('https://localhost:9443')
                .get('/api/1.1/config?auth_token=' + token)
                .expect(SUCCESS_STATUS);
        });

        it('Should still able to access after certain time', function() {
            this.timeout(5000);
            var Promise = helper.injector.get('Promise');
            return Promise.delay(1000)
                .then(function(){
                    return helper.request('https://localhost:9443')
                        .get('/api/1.1/config?auth_token=' + token)
                        .expect(SUCCESS_STATUS);
                });
        });

        after('stop server, restore mock and configure',function () {
            return cleanUp();
        });
    });

    describe('Should fail with token signature errors', function () {
        before('start http and https server', function () {
            this.timeout(5000);
            var authService = helper.injector.get('Auth.Services');
            var jwt = require('jsonwebtoken');
            sandbox.stub(authService, 'createJwtToken',function () {
                    var self = this;
                    return jwt.sign({
                            user: 'test_user'
                        },
                        self.secretOrKey,
                        self.jwtSignOptions
                    );
                });
            setConfig();
            return startServer(endpoint);
        });

        it('should return a token from /login', function () {
            return helper.request('https://localhost:9443')
                .post('/login')
                .send({username: "admin", password: "admin123"})
                .expect(SUCCESS_STATUS)
                .expect(function(res) {
                    expect(res.body.token).to.be.a('string');
                    token = res.body.token;
                });
        });

        it('Should get token expire error', function() {
            this.timeout(5000);

            return helper.request('https://localhost:9443')
                .get('/api/1.1/config?auth_token=' + token)
                .expect(401)
                .expect(function (res) {
                    expect(res.body.message).to.be.a('string');
                    expect(res.body.message).to.equal('Unauthorized');
                });
        });

        after('stop server, restore mock and configure',function () {
            return cleanUp();
        });
    });
});
