// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved.

'use strict';

require('on-core/spec/helper');

var util = require('util');

var index = require('../index');

var mockConsul = require('./mock-consul-server.js');
var mockGrpc = require('./mock-grpc.js');
var mockery = require('mockery');
mockery.enable();
mockery.warnOnUnregistered(false);
mockery.registerMock('consul', mockConsul);
mockery.registerMock('grpc', mockGrpc);

global.onHttpContext = index.onHttpContextFactory();

// Legacy
global.dihelper = onHttpContext.helper;

helper.startServer = function (overrides, endpointOpt) {
    overrides = (overrides || []).concat([
        onHttpContext.helper.simpleWrapper({
            publishLog: sinon.stub().resolves()
        }, 'Protocol.Logging'),
        onHttpContext.helper.simpleWrapper({
            lookupIpLease: sinon.stub().resolves('00:00:00:00:00:00')
        }, 'Protocol.Dhcp')
    ]);

    helper.setupInjector(_.flattenDeep([
        onHttpContext.prerequisiteInjectables,
        onHttpContext.injectables,
        overrides
    ]));

    helper.setupTestConfig();

    helper.injector.get('Services.Configuration')
        .set('enableUPnP', false)
        .set('skuPackRoot', 'spec/lib/services/sku-static')
        .set('httpEndpoints', [_.merge({},
            {
                'port': 8091,
                'httpsEnabled': false,
                "yamlName": ["monorail-2.0-sb.yaml"]
            },
            endpointOpt),
            _.merge({},
                {
                    'port': 8089,
                    'httpsEnabled': false,
                    "yamlName": ["monorail-2.0.yaml", "redfish.yaml"]
                },
                endpointOpt)
        ]);

    index.injector = helper.injector;

    return helper.injector.get('app').start();
};

helper.stopServer = function () {
    return helper.injector.get('app').stop();
};

helper.request = function (url, options) {
    var agent = request(url || 'http://localhost:8089', options);

    // monkeypatch supertest objects to have a "then" function so they can be used as promises
    _.methods(agent).forEach(function (method) {
        var orig = agent[method];
        agent[method] = function () {
            var test = orig.apply(agent, arguments);

            test.then = function (successCallback, errorCallback) {
                var deferred = new Promise(function (resolve, reject) {
                    test.end(function(err, res) {
                        if (err) {
                            // if a status check fails, supertest will pass the res object as well.
                            // so, append some extra verbosity to the error for the report.
                            if (res) {
                                var output = res.body || res.text;
                                err.message +=
                                '\nResponse body:\n'+
                                util.inspect(output) +
                                '\n' + err.stack;
                            }
                            reject(err);
                            return;
                        } else {
                            resolve(res);
                        }
                    });
                });

                return deferred.then(successCallback, errorCallback);
            };
            return test;
        };
    });

    return agent;
};
