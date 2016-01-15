// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

var WebSocket = require('ws');

describe('Services.WebSocket', function () {
    var app,
        server;

    helper.before(function () {
        return [
            onHttpContext.helper.simpleWrapper(require('express')(), 'express-app'),
            onHttpContext.helper.simpleWrapper(WebSocket.Server, 'WebSocketServer'),
            onHttpContext.helper.simpleWrapper({}, 'Task.Services.OBM'),
            onHttpContext.helper.simpleWrapper({}, 'ipmi-obm-service'),
            onHttpContext.helper.requireWrapper('rimraf', 'rimraf'),
            onHttpContext.helper.requireWrapper('os-tmpdir', 'osTmpdir'),
            helper.requireGlob('/lib/**/*.js')
        ];
    });

    before(function () {
        app = helper.injector.get('express-app');
        server = helper.injector.get('Http.Server');
        helper.injector.get('Services.Configuration')
                .set('httpEnabled', true)
                .set('httpsEnabled', false)
                // can't use port 80 because it requires setuid root
                .set('httpBindPort', 8089);
        server.listen();
    });

    after(function () {
        server.close();
    });

    helper.after();

    describe('a ws client', function () {
        var ws;

        before(function (next) {
            ws = new WebSocket('ws://localhost:8089');
            ws.onopen = function () { next(); };
            ws.onerror = next;
        });

        after(function () {
            ws.terminate();
        });

        describe('init', function () {
            it('should respond with a session', function (next) {
                ws.onerror = next;
                ws.onmessage = function (event) {
                    var msg = JSON.parse(event.data);
                    expect(msg).to.be.ok;
                    expect(msg.id).to.be.ok;
                    expect(msg.handler).to.equal('session');
                    next();
                };
                ws.send(JSON.stringify({handler: 'init'}));
            });
        });

        describe('db resource', function () {
            var waterline,
                    catalogs;

            before(function () {
                waterline = helper.injector.get('Services.Waterline');
                catalogs = waterline.catalogs;
            });

            describe('query', function () {
                it('should respond with a list', function (next) {
                    ws.onerror = next;
                    ws.onmessage = function (event) {
                        var msg = JSON.parse(event.data);
                        expect(msg).to.be.ok;
                        expect(msg.items).to.be.ok;
                        expect(msg.handler).to.equal('list');
                        next();
                    };
                    ws.send(JSON.stringify(
                        {handler: 'query', resource: 'catalogs', params: {id: null}}));
                });
            });

            describe('all', function () {
                it('should respond with a list', function (next) {
                    ws.onerror = next;
                    ws.onmessage = function (event) {
                        var msg = JSON.parse(event.data);
                        expect(msg).to.be.ok;
                        expect(msg.items).to.be.ok;
                        expect(msg.handler).to.equal('list');
                        next();
                    };
                    ws.send(JSON.stringify({handler: 'all', resource: 'catalogs'}));
                });
            });

            describe('get', function () {
                it('should respond with an item', function (next) {
                    ws.onerror = next;
                    ws.onmessage = function (event) {
                        var msg = JSON.parse(event.data);
                        expect(msg).to.be.ok;
                        // expect(msg.data).to.be.undefined;
                        expect(msg.handler).to.equal('item');
                        next();
                    };
                    ws.send(JSON.stringify(
                        {handler: 'get', resource: 'catalogs', params: {id: null}}));
                });
            });

            describe('watch', function () {
                before(function () {
                    ws.send(JSON.stringify({handler: 'watch', resource: 'catalogs'}));
                });

                var ID;

                it('should listen for created items', function (next) {
                    ws.onerror = next;
                    ws.onmessage = function (event) {
                        var msg = JSON.parse(event.data);
                        expect(msg).to.be.ok;
                        expect(msg.id).to.be.ok;
                        expect(msg.data).to.be.ok;
                        expect(msg.id[0]).to.equal('created');
                        expect(msg.id[1]).to.equal(msg.data.id);
                        expect(msg.data.node).to.equal('node');
                        expect(msg.data.source).to.equal('source');
                        expect(msg.data.data).to.ok;
                        expect(msg.handler).to.equal('item');
                        ID = msg.data.id;
                        next();
                    };
                    setTimeout(function () {
                        catalogs.create({node: 'node', source: 'source', data: {}}).then();
                    }, 100);
                });

                it('should listen for updated items', function (next) {
                    ws.onerror = next;
                    ws.onmessage = function (event) {
                        var msg = JSON.parse(event.data);
                        expect(msg).to.be.ok;
                        expect(msg.id).to.be.ok;
                        expect(msg.data).to.be.ok;
                        expect(msg.id[0]).to.equal('updated');
                        expect(msg.id[1]).to.equal(msg.data.id);
                        expect(msg.data.source).to.equal('source2');
                        expect(msg.handler).to.equal('item');
                        next();
                    };
                    setTimeout(function () {
                        catalogs.update(ID, {source: 'source2'}).then();
                    }, 100);
                });

                it('should listen for removed items', function (next) {
                    ws.onerror = next;
                    ws.onmessage = function (event) {
                        var msg = JSON.parse(event.data);
                        expect(msg).to.be.ok;
                        expect(msg.data).to.be.ok;
                        expect(msg.id).to.equal(msg.data.id);
                        expect(msg.handler).to.equal('remove');
                        next();
                    };
                    setTimeout(function () {
                        catalogs.destroy(ID).then();
                    }, 100);
                });
            });

            describe('stop', function () {
                it('should unsubscribe', function (next) {
                    ws.onerror = next;
                    ws.onmessage = function () {
                        next('Got message when one was not expected');
                    };
                    ws.send(JSON.stringify({handler: 'stop', resource: 'catalogs'}));
                    setTimeout(function () {
                        catalogs.create({node: 'node', source: 'source', data: {}});
                        setTimeout(next, 500);
                    }, 100);
                });
            });
        });

        describe('mq resource', function () {
            var messenger;

            before(function (next) {
                messenger = helper.injector.get('Services.Messenger');
                messenger.start().then(
                    function () { next(); },
                    next);
            });

            after(function (next) {
                messenger.stop().then(
                    function () { next(); },
                    next);
            });

            describe('watch', function () {
                it('should listen for new items', function (next) {
                    ws.onerror = next;
                    ws.onmessage = function (event) {
                        var msg = JSON.parse(event.data);
                        expect(msg).to.be.ok;
                        expect(msg.id).to.equal('routing.key.value');
                        expect(msg.data).to.eql({key: 'value'});
                        expect(msg.handler).to.equal('item');
                        next();
                    };
                    ws.send(JSON.stringify({handler: 'watch', resource: 'mq', params: {
                        exchange: 'on.test',
                        routingKey: '#'
                    }}));
                    setTimeout(function () {
                        messenger.publish('on.test', 'routing.key.value', {key: 'value'});
                    }, 50);
                });
            });

            describe('stop', function () {
                it('should unsubscribe', function (next) {
                    ws.onerror = next;
                    ws.onmessage = function () {
                        next('Got message when one was not expected');
                    };
                    ws.send(JSON.stringify({handler: 'stop', resource: 'mq', params: {
                        exchange: 'on.test',
                        routingKey: '#'
                    }}));
                    setTimeout(function () {
                        messenger.publish('on.test', 'routing.key.value', {key: 'value'});
                        setTimeout(next, 500);
                    }, 50);
                });
            });
        });
    });
});
