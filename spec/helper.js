'use strict';

require('renasar-core/spec/helper');

var di = require('di');
global.core = require('renasar-core')(di);
global.dihelper = core.helper;

helper.startServer = function (overrides) {

    helper.setupInjector(_.flatten([
            require('renasar-tasks').injectables,
            dihelper.simpleWrapper(require('renasar-mq'), 'MQ'),
            dihelper.simpleWrapper(require('express')(), 'express-app'),
            dihelper.simpleWrapper({
                publishLog: sinon.stub().returns(Q.resolve())
            }, 'Protocol.Logging'),
            dihelper.simpleWrapper({
                lookupIpLease: sinon.stub().returns(Q.resolve('00:00:00:00:00:00'))
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
