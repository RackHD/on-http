// Copyright 2015-2016, EMC, Inc.

'use strict';

var express = require('express');

describe('Http.Server', function () {
    var HttpService;
    var services = [];
    var singleService;
    var defaultRouter = express.Router();

    var nock = require('nock');
    helper.before(function () {
        return [
            dihelper.simpleWrapper(require('express')(), 'express-app'),
            dihelper.simpleWrapper(require('swagger-express-mw'),
                'swagger', undefined, __dirname),
            dihelper.simpleWrapper({}, 'Task.Services.OBM'),
            onHttpContext.helper.simpleWrapper({}, 'TaskGraph.TaskGraph'),
            onHttpContext.helper.simpleWrapper({}, 'TaskGraph.Store'),
            dihelper.simpleWrapper({}, 'ipmi-obm-service'),
            dihelper.requireWrapper('rimraf', 'rimraf', undefined, __dirname),
            dihelper.requireWrapper('os-tmpdir', 'osTmpdir', undefined, __dirname),
            helper.require('/lib/services/http-service'),
            helper.requireGlob('/lib/api/*.js'),
            helper.requireGlob('/lib/api/1.1/**/*.js'),
            helper.requireGlob('/lib/services/**/*.js'),
            helper.requireGlob('/lib/serializables/**/*.js'),
            helper.requireGlob('/lib/api/view/**/*.js')
        ];
    });

    before(function () {
        HttpService = helper.injector.get('Http.Server');

        defaultRouter.use('/test', function (req, res) {
            res.send('Hello World!');
        });
    });

    helper.after();

    before('allow self signed certs', function () {
       process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    });

    after('disallow self signed certs', function () {
       process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';
    });

    describe('http', function () {
        before('start', function () {
            // can't use port 80 because it requires setuid root
            singleService = new HttpService({ port: 8089 });
            singleService.app.use(defaultRouter);
            singleService.start();
        });

        it('should respond to requests', function () {
            return helper.request('http://localhost:8089')
            .get('/test')
            .expect(200)
            .expect('Hello World!');
        });

        after('stop', function () {
            singleService.stop();
        });
    });

    describe('https', function () {
        before('start', function () {
            // can't use port 443 because it requires setuid root
            singleService = new HttpService(
                {
                    'port': 9443,
                    'httpsEnabled': true,
                    'httpsCert': 'data/dev-cert.pem',
                    'httpsKey': 'data/dev-key.pem'
                }
            );
            singleService.app.use(defaultRouter);
            singleService.start();
        });

        it('should respond to requests', function () {
            return helper.request('https://localhost:9443')
            .get('/test')
            .expect(200)
            .expect('Hello World!');
        });

        after('stop', function () {
            singleService.stop();
        });
    });

    describe('https with pfx', function () {
        before('start', function () {
            // can't use port 443 because it requires setuid root
            singleService = new HttpService(
                {
                    'port': 8444,
                    'httpsEnabled': true,
                    'httpsPfx': 'data/dev.pfx'
                }
            );
            singleService.app.use(defaultRouter);
            singleService.start();
        });

        it('should respond to requests', function () {
            return helper.request('https://localhost:8444')
            .get('/test')
            .expect(200)
            .expect('Hello World!');
        });

        after('stop', function () {
            singleService.stop();
        });
    });

    describe('http multi endpoints', function () {
        before('start', function () {
            var endpoints = [
                {
                    'address': '0.0.0.0',
                    'port': 9443,
                    'httpsEnabled': true,
                    'httpsCert': 'data/dev-cert.pem',
                    'httpsKey': 'data/dev-key.pem',
                    'httpsPfx': null,
                },
                {
                    'address': '0.0.0.0',
                    'port': 9880,
                    'httpsEnabled': false,
                },
                {
                    'address': '0.0.0.0',
                    'port': 8089,
                    'httpsEnabled': false,
                }
            ];

            var requestHandler = function (req, res) {
                res.send('This is from endpoint path ' + req.baseUrl);
            };
            for (var i = 0; i < endpoints.length; i += 1) {
                var service = new HttpService(endpoints[i]);
                services.push(service);
                service.app.use('/test/' + i, requestHandler);
                service.start();
            }
        });

        it('should respond to request to endpoint 1', function () {
            return helper.request('https://localhost:9443')
            .get('/test/0')
            .expect(200)
            .expect('This is from endpoint path /test/0');
        });

        it('should respond to request to endpoint 2', function () {
            return helper.request('http://localhost:9880')
            .get('/test/1')
            .expect(200)
            .expect('This is from endpoint path /test/1');
        });

        it('should respond to request to endpoint 3', function () {
            return helper.request('http://localhost:8089')
            .get('/test/2')
            .expect(200)
            .expect('This is from endpoint path /test/2');
        });

        it('should respond Not Found to incorrect router path', function () {
            return helper.request('http://localhost:8089')
            .get('/test/1')
            .expect(404);
        });

        after('stop', function () {
            services.forEach(function (service) {
                service.stop();
            });
        });
    });

    describe('http proxy', function () {
        before('start', function () {
            var proxyConfig = [
                {
                    'localPath': '/local/proxy1',
                    'server': 'http://test.com',
                    'remotePath': '/remote1/'
                },
                {
                    'localPath': 'local/proxy2',
                    'server': 'http://test.com'
                },
                {
                    'server': 'http://test.com',
                    'remotePath': '/remote3'
                },
                {
                    //this is to test whether server.listen can still run without speicfy server
                    'localPath': '/local/proxy4',
                    'remotePath': '/remote4'
                },
                {
                    'server': 'http://test.com',
                    'remotePath': 'remote5',
                    'localPath': '/local/proxy5/'
                }
            ];

            helper.injector.get('Services.Configuration')
                .set('httpProxies', proxyConfig);

            singleService = new HttpService(
                {
                    'port': 8099,
                    'httpsEnabled': false,
                    'proxiesEnabled': true
                }
            );
            defaultRouter.use('/local/proxy5/foo/bar', function (req, res) {
                res.send('This is local Foo Bar5!');
            });

            singleService.app.use(defaultRouter);

            singleService.start();

            nock('http://test.com')
                .get('/').reply(200, 'Root Resource')
                .get('/remote1/foo/bar').reply(200, 'This is Foo Bar1!')
                .get('/remote2/foo/bar').reply(200, 'This is Foo Bar2!')
                .get('/remote3/foo/bar').reply(200, 'This is Foo Bar3!')
                .get('/remote4/foo/bar').reply(200, 'This is Foo Bar4!')
                .get('/remote5/foo/bar').reply(200, 'This is Foo Bar5!');
        });

        it('should respond to remote request via proxy', function () {
            return helper.request('http://localhost:8099')
                .get('/local/proxy1/foo/bar')
                .expect(200)
                .expect('This is Foo Bar1!');
        });

        it('should proxy to remote root path if missing remotePath', function () {
            return helper.request('http://localhost:8099')
                .get('/local/proxy2/remote2/foo/bar')
                .expect(200)
                .expect('This is Foo Bar2!');
        });

        it('should proxy to local root path if missing localPath', function () {
            return helper.request('http://localhost:8099')
                .get('/foo/bar')
                .expect(200)
                .expect('This is Foo Bar3!');
        });

        it('should favor local source over proxy', function() {
            return helper.request('http://localhost:8099')
                .get('/local/proxy5/foo/bar')
                .expect('This is local Foo Bar5!');
        });

        after('stop', function () {
            singleService.stop();
            nock.restore();
            //Configuration is shared globaly
            //Should reset the configureation for other feature unit tests
            helper.injector.get('Services.Configuration')
                .set('httpProxies', []);
        });
    });

    describe('Patching the swagger config yaml', function () {
        var di,
            parsedYamlJson,
            result,
            swaggerConfig;
        function returns(obj) { return function () { return obj; }; }
        function setupDi() {
            parsedYamlJson = {name: 'swagger-config-json'};
            di = {
                fs: {
                    readFileSync: sinon.spy(returns('raw-swagger-config-yaml')),
                    writeFileSync: sinon.spy()
                },
                logger: { error: sinon.spy() },
                Promise: {
                    resolve: sinon.spy(returns('resolved-promise')),
                    reject: sinon.spy(returns('rejected-promise'))
                },
                yaml: {
                    safeLoad: sinon.spy(returns(parsedYamlJson)),
                    safeDump: sinon.spy(returns('raw-swagger-config-yaml-patched'))
                }
            };
        }
        function invokePatchYamlConfig(httpsEnabled) {
            var patchYamlConfig = HttpService.prototype.patchYamlConfig;
            swaggerConfig = {swagger: 'swagger-config-yaml-file-path.yaml'};
            result = patchYamlConfig(
                {httpsEnabled: httpsEnabled},
                swaggerConfig,
                di);
        }
        describe('(http) when it works', function () {
            beforeEach(function() {
                setupDi();
                invokePatchYamlConfig(false);
            });
            it('should read the swagger config yaml file', function () {
                expect(di.fs.readFileSync).to.have.been.calledOnce;
                expect(di.fs.readFileSync).to.have.been.calledWith(
                    'swagger-config-yaml-file-path.yaml',
                    'utf8');
            });
            it('should parse the yaml into json', function () {
                expect(di.yaml.safeLoad).to.have.been.calledOnce;
                expect(di.yaml.safeLoad).to.have.been.calledWith(
                    'raw-swagger-config-yaml');
            });
            it('should update the swager config json schemes', function () {
                expect(swaggerConfig.swagger).to.equal(
                    'swagger-config-yaml-file-path-patch.yaml');
                expect(parsedYamlJson.schemes).to.eql(['http']);
            });
            it('should convert json to yaml', function () {
                expect(di.yaml.safeDump).to.have.been.calledOnce;
                expect(di.yaml.safeDump).to.have.been.calledWith(parsedYamlJson);
            });
            it('should write the yaml to a patched yaml file', function () {
                expect(di.fs.writeFileSync).to.have.been.calledOnce;
                expect(di.fs.writeFileSync).to.have.been.calledWith(
                    'swagger-config-yaml-file-path-patch.yaml',
                    'raw-swagger-config-yaml-patched');
            });
            it('should return a resolved promise', function () {
                expect(di.Promise.resolve).to.have.been.calledOnce;
                expect(di.Promise.resolve).to.have.been.calledWith(swaggerConfig);
                expect(result).to.equal('resolved-promise');
            });
        });
        describe('(https) when it fails', function () {
            setupDi();
            var error = 'error',
                originalWriteFileSync = di.fs.writeFileSync;
            beforeEach(function () {
                setupDi();
                di.fs.writeFileSync = function () {throw error;};
                invokePatchYamlConfig(true);
            });
            afterEach(function () {
                di.fs.writeFileSync = originalWriteFileSync;
            });
            it('should update the swager config json schemes', function () {
                expect(parsedYamlJson.schemes).to.eql(['https']);
            });
            it('should log the error', function () {
                expect(di.logger.error).to.have.been.calledOnce;
                expect(di.logger.error).to.have.been.calledWith('error');
            });
            it('should return a rejected promise', function () {
                expect(di.Promise.reject).to.have.been.calledOnce;
                expect(di.Promise.reject).to.have.been.calledWith('error');
                expect(result).to.equal('rejected-promise');
            });
        });
    });
});
