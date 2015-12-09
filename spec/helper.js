// Copyright 2015, EMC, Inc.

'use strict';

require('on-core/spec/helper');

var ws = require('ws');

var util = require('util');

global.onHttpContext = require('../index')();

// Legacy
global.dihelper = onHttpContext.helper;

helper.startServer = function (overrides) {
    overrides = (overrides || []).concat([
        onHttpContext.helper.simpleWrapper({
            publishLog: sinon.stub().resolves()
        }, 'Protocol.Logging'),
        onHttpContext.helper.simpleWrapper({
            lookupIpLease: sinon.stub().resolves('00:00:00:00:00:00')
        }, 'Protocol.Dhcp')
    ]);

    helper.setupInjector(_.flatten([
        onHttpContext.prerequisiteInjectables,
        onHttpContext.expressApp(),
        onHttpContext.injectables,
        overrides
    ]));

    helper.setupTestConfig();

    helper.injector.get('Services.Configuration')
        .set('httpEnabled', true)
        .set('httpsEnabled', false)
        .set('httpBindPort', 8089)
        .set('skuPackRoot', 'spec/lib/services/sku-static');

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
