'use strict';

require('on-core/spec/helper');

var di = require('di');
var util = require('util');
global.core = require('on-core')(di);
global.dihelper = core.helper;

helper.startServer = function (overrides) {

    helper.setupInjector(_.flatten([
            require('on-tasks').injectables,
            dihelper.simpleWrapper(require('express')(), 'express-app'),
            dihelper.simpleWrapper({
                publishLog: sinon.stub().resolves()
            }, 'Protocol.Logging'),
            dihelper.simpleWrapper({
                lookupIpLease: sinon.stub().resolves('00:00:00:00:00:00')
            }, 'Protocol.Dhcp'),
            helper.requireGlob('/lib/**/*.js'),
            helper.require('/app.js')
    ].concat(overrides || [])));
    helper.setupTestConfig();
    helper.injector.get('Services.Configuration')
        .set('http', true)
        .set('https', false)
        .set('httpPort', 8089);
    return helper.injector.get('Http').start();
};

helper.stopServer = function () {
    return helper.injector.get('Http').stop();
};

helper.request = function (url, options) {
    var agent = request(url || 'http://localhost:8089', options);

    // monkeypatch supertest objects to have a "then" function so they can be used as promises
    _.methods(agent).forEach(function (method) {
        var orig = agent[method];
        agent[method] = function () {
            var test = orig.apply(agent, arguments);
            test.then = function (successCallback, errorCallback) {
                var deferred = Q.defer();
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
                        deferred.reject(err);
                        return;
                    } else {
                        deferred.resolve(res);
                    }
                });
                return deferred.promise.then(successCallback, errorCallback);
            };
            return test;
        };
    });

    return agent;
};
