// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

describe(require('path').basename(__filename), function () {
    describe('_buildContext()', function() {
        var config;
        var env;
        var configGetAllStub;
        var envGetStub;
        var presenter;
        var req;
        var res;
        before(function() {
            helper.setupInjector([
                helper.require("/lib/services/common-api-presenter.js")
            ]);
            config = helper.injector.get('Services.Configuration');
            env = helper.injector.get('Services.Environment');
            envGetStub = sinon.stub(env, 'get');
            req = {
                get: sinon.stub()
            };
            res = {
                locals: {
                    scope: 'global'
                }
            };
            presenter = helper.injector.get('common-api-presenter');
        });

        afterEach(function() {
            configGetAllStub.restore();
        });

        it('should return file.server when configuring fileServerAddress', function() {
            configGetAllStub = sinon.stub(config, 'getAll', function() {
                return {
                    apiServerAddress: '10.1.1.1',
                    apiServerPort: 80,
                    fileServerAddress: '10.1.1.2',
                    fileServerPort: 8080,
                    fileServerPath: '/static'
                };
            });
            return presenter(req, res)
                ._buildContext({}, true)
                .then(function(options) {
                    expect(options.file.server).to.equal('http://10.1.1.2:8080/static');
                });
        });
        it('should return file.server when not configuring fileServerAddress', function() {
            configGetAllStub = sinon.stub(config, 'getAll', function() {
                return {
                    apiServerAddress: '10.1.1.1',
                    apiServerPort: 80,
                };
            });
            return presenter(req, res)
                ._buildContext({}, true)
                .then(function(options) {
                    expect(options.file.server).to.equal('http://10.1.1.1:80');
                });
        });
    });
});
