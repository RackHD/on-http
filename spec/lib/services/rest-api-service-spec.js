// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

var express = require('express');
var util = require('util');

var PORT = 8089;
var TESTURL = 'http://localhost:' + PORT;

// setup/teardown for express app within a describe block
function expressAppSetup(callback) {
    var server;
    beforeEach('create express app', function () {
        var app = express();
        callback(app);
        server = app.listen(PORT);
    });

    afterEach('close express app', function () {
        server.close();
    });
}

describe('Http.Server', function () {
    var rest;
    var Errors;
    var Serializable;
    var MockSerializable;
    var ThrowSerializable;
    var Promise;

    before('set up test dependencies', function() {
        MockSerializable = function () {
            Serializable.call(
                this,
                {
                    id: 'MockSerializable',
                    type: 'object',
                    properties: {
                        value: {
                            type: 'string'
                        }
                    }
                }
            );
        };

        ThrowSerializable = function () {

            Serializable.call(
                this,
                {
                    id: 'MockSerializable',
                    type: 'object',
                    properties: {
                        value: {
                            type: 'string'
                        }
                    }
                }
            );
        };

        helper.setupInjector(_.flattenDeep([
            helper.require('/lib/services/rest-api-service.js'),
            helper.di.simpleWrapper(MockSerializable, 'MockSerializable'),
            helper.di.simpleWrapper(ThrowSerializable, 'ThrowSerializable')
        ]));

        rest = helper.injector.get('Http.Services.RestApi');
        Errors = helper.injector.get('Errors');
        Serializable = helper.injector.get('Serializable');
        Promise = helper.injector.get('Promise');

        util.inherits(MockSerializable, Serializable);
        util.inherits(ThrowSerializable, Serializable);

        ThrowSerializable.prototype.serialize = function () {
            throw new Error('serialize');
        };

        ThrowSerializable.prototype.deserialize = function () {
            throw new Error('deserialize');
        };
    });

    describe('rest()', function () {
        var app;
        expressAppSetup(function (app_) {
            app = app_;
        });

        it('should 200 with a returned object literal', function () {
            app.get('/testfuncstatic', rest(function () {
                return { foo: 'bar' };
            }));

            return helper.request(TESTURL).get('/testfuncstatic')
                .expect('Content-Type', /^application\/json/)
                .expect(200, { foo: 'bar' });
        });

        it('should 200 with a returned array literal', function () {
            app.get('/testfuncstatic', rest(function () {
                return [{ foo: 'bar' }, { foo: 'baz' }];
            }, { isArray: true }));

            return helper.request(TESTURL).get('/testfuncstatic')
                .expect('Content-Type', /^application\/json/)
                .expect(200, [{ foo: 'bar' }, { foo: 'baz' }]);
        });

        it('should have an undefined body when POSTing no content',
           function () {
            app.post('/testblankbody', rest(function (req) {
                expect(req.body).to.be.undefined;
                return { bad: 'notbad' };
            }));

            return helper.request(TESTURL).post('/testblankbody')
                .expect('Content-Type', /^application\/json/)
                .expect(200, { bad: 'notbad' });
        });

        it('should 400 when POSTing bad JSON', function () {
            app.post('/testbadjson', rest(function () {
                return { foo: 'bar' };
            }));

            return helper.request(TESTURL).post('/testbadjson')
                .set('Content-Type', 'application/json')
                .send('{badjson-1;d.c;zdg}')
                .expect('Content-Type', /^application\/json/)
                .expect(400)
                .expect(function (req) {
                    expect(req.body).to.have.property('message')
                        .to.equal('Error parsing JSON: Unexpected token b');
                });
        });

        it('should 400 when POSTing a non-JSON content-type', function () {
            app.post('/testbadcontenttype', rest(function () {
                return { foo: 'bar' };
            }));

            return helper.request(TESTURL).post('/testbadcontenttype')
                .set('Content-Type', 'text/plain')
                .send('happy text string')
                .expect('Content-Type', /^application\/json/)
                .expect(400)
                .expect(function (req) {
                    expect(req.body).to.have.property('message')
                        .that.equals('Content-Type must be application/json');
                });
        });

        it('should allow setting a status code from the callback', function () {
            app.get('/testfuncmanual', rest(function (req, res) {
                res.status(202);
                // this return value should get ignored
                return { bar: 'baz' };
            }));

            return helper.request(TESTURL).get('/testfuncmanual')
                .expect('Content-Type', /^application\/json/)
                .expect(202, { bar: 'baz' });
        });

        it('should allow writing a response from the callback', function () {
            app.get('/testfuncmanual', rest(function (req, res) {
                res.status(201);
                res.json({ bar: 'foo' });
                // this return value should get ignored
                return { foo: 'bar' };
            }));

            return helper.request(TESTURL).get('/testfuncmanual')
                .expect('Content-Type', /^application\/json/)
                .expect(201, { bar: 'foo' });
        });

        it('should 500 error on thrown error', function () {
            app.get('/testerrorthrow', rest(function () {
                throw Error('broken route');
            }));

            return helper.request(TESTURL).get('/testerrorthrow')
                .expect('Content-Type', /^application\/json/)
                .expect(500)
                .expect(function (req) {
                    expect(req.body).to.have.property('message').that.equals('broken route');
                });
        });

        it('should return a custom status code for success', function () {
            app.get('/testsuccess201', rest(function () {
                return { success: ':)' };
            }, {
                renderOptions: {
                    success: 201
                }
            }));

            return helper.request(TESTURL).get('/testsuccess201')
                .expect('Content-Type', /^application\/json/)
                .expect(201, { success: ':)' });
        });

        it('should 200 with a resolved promise', function () {
            app.get('/testfuncpromise', rest(function () {
                return Promise.resolve({ foo: 'baz' });
            }));

            return helper.request(TESTURL).get('/testfuncpromise')
                .expect('Content-Type', /^application\/json/)
                .expect(200, { foo: 'baz' });
        });

        it('should 500 error on rejected promise with an Error', function () {
            app.get('/testpromisereject', rest(function () {
                return Promise.reject(new Error('broken promise'));
            }));

            return helper.request(TESTURL).get('/testpromisereject')
                .expect('Content-Type', /^application\/json/)
                .expect(500)
                .expect(function (req) {
                    expect(req.body).to.have.property('message').that.equals('broken promise');
                });
        });

        it('should 500 error on rejected promise with a string', function () {
            app.get('/testpromiserejectstring', rest(function () {
                return Promise.reject('broken promise string');
            }));

            return helper.request(TESTURL).get('/testpromiserejectstring')
                .expect('Content-Type', /^application\/json/)
                .expect(500)
                .expect(function (req) {
                    expect(req.body).to.have.property('message')
                    .that.equals('broken promise string');
                });
        });

        it('should 500 error on rejected promise with an object', function () {
            app.get('/testpromiserejectobject', rest(function () {
                return Promise.reject({ thing: 'errored' });
            }));

            return helper.request(TESTURL).get('/testpromiserejectobject')
                .expect('Content-Type', /^application\/json/)
                .expect(500)
                .expect(function (req) {
                    expect(req.body).to.have.property('thing')
                    .that.equals('errored');
                });
        });

        it('should 500 error on rejected promise with undefined', function () {
            app.get('/testpromiserejectundefined', rest(function () {
                return Promise.reject();
            }));

            return helper.request(TESTURL).get('/testpromiserejectundefined')
                .expect('Content-Type', /^application\/json/)
                .expect(500)
                .expect(function (req) {
                    expect(req.body).to.have.property('message')
                    .that.equals('Unspecified Error');
                });
        });

        it('should 204 on blank content', function () {
            app.get('/testblankallowempty', rest(function () {
                return null;
            }));

            return helper.request(TESTURL).get('/testblankallowempty')
                .expect(204);
        });

        it('should serialize an object', function () {
            app.get('/testserializer', rest(function () {
                return { item: 'value' };
            }, { serializer: function (object) {
                object.item += 'added';
                return object;
            } }));

            return helper.request(TESTURL).get('/testserializer')
                .expect('Content-Type', /^application\/json/)
                .expect(200, { item: 'valueadded' });
        });

        it('should serialize an array of objects', function () {
            app.get('/testarrayserializer', rest(function () {
                return [{ item: 'value1' }, { item: 'value2'}];
            }, { serializer: function (object) {
                object.item += 'added';
                return object;
            }, isArray: true }));

            return helper.request(TESTURL).get('/testarrayserializer')
                .expect('Content-Type', /^application\/json/)
                .expect(200, [{ item: 'value1added' }, { item: 'value2added' }]);
        });

        it('should serialize an object by resolving a promise', function () {
            app.get('/testpromiseserializer', rest(function () {
                return { item: 'value' };
            }, { serializer: function (object) {
                object.item += 'promised';
                return Promise.resolve(object);
            } }));

            return helper.request(TESTURL).get('/testpromiseserializer')
                .expect('Content-Type', /^application\/json/)
                .expect(200, { item: 'valuepromised' });
        });

        it('should 500 if a serializer throws an error', function () {
            app.get('/testerrorserializer', rest(function () {
                return { item: 'value' };
            }, { serializer: function () {
                throw new Error('serializer crash!');
            } }));

            return helper.request(TESTURL).get('/testerrorserializer')
                .expect('Content-Type', /^application\/json/)
                .expect(500)
                .expect(function (req) {
                    expect(req.body).to.have.property('message').that.equals('serializer crash!');
                });
        });

        it('should 500 if a serializer returns a rejected promise', function () {
            app.get('/testrejectserializer', rest(function () {
                return { item: 'value' };
            }, { serializer: function () {
                return Promise.reject(new Error('serializer reject!'));
            } }));

            return helper.request(TESTURL).get('/testrejectserializer')
                .expect('Content-Type', /^application\/json/)
                .expect(500)
                .expect(function (req) {
                    expect(req.body).to.have.property('message').that.equals('serializer reject!');
                });
        });

        it('should deserialize the response', function () {
            app.post('/testdeserializer', rest(function (req) {
                expect(req.body).to.have.property('value').that.equals(124);
                return {
                    val: req.body.value
                };
            }, { deserializer: function (object) {
                return {
                    value: object.val + 1
                };
            } }));

            return helper.request(TESTURL).post('/testdeserializer')
                .send({ val: 123 })
                .expect('Content-Type', /^application\/json/)
                .expect(200, { val: 124 });
        });

        it('should deserialize the response with a promise', function () {
            app.post('/testpromisedeserializer', rest(function (req) {
                expect(req.body).to.have.property('value').that.equals(125);
                return {
                    val: req.body.value
                };
            }, { deserializer: function (object) {
                return Promise.resolve({
                    value: object.val + 2
                });
            } }));

            return helper.request(TESTURL).post('/testpromisedeserializer')
                .send({ val: 123 })
                .expect('Content-Type', /^application\/json/)
                .expect(200, { val: 125 });
        });

        it('should 500 if a deserializer throws an error', function () {
            app.get('/testerrordeserializer', rest(function () {
                return { item: 'value' };
            }, { deserializer: function () {
                throw new Error('deserializer crash!');
            } }));

            return helper.request(TESTURL).get('/testerrordeserializer')
                .expect('Content-Type', /^application\/json/)
                .expect(500)
                .expect(function (req) {
                    expect(req.body).to.have.property('message')
                        .that.equals('deserializer crash!');
                });
        });

        it('should 500 if a deserializer returns a rejected promise', function () {
            app.get('/testrejectdeserializer', rest(function () {
                return { item: 'value' };
            }, { deserializer: function () {
                return Promise.reject(new Error('deserializer reject!'));
            } }));

            return helper.request(TESTURL).get('/testrejectdeserializer')
                .expect('Content-Type', /^application\/json/)
                .expect(500)
                .expect(function (req) {
                    expect(req.body).to.have.property('message')
                        .that.equals('deserializer reject!');
                });
        });

        it('should 400 if a deserializer returns a promise rejected with a ValidationError',
           function () {
            app.get('/testrejectvalidationdeserializer', rest(function () {
                return { item: 'value' };
            }, { deserializer: function () {
                return Promise.reject(new Error(new Errors.ValidationError()));
            } }));

            return helper.request(TESTURL).get('/testrejectvalidationdeserializer')
                .expect('Content-Type', /^application\/json/)
                .expect(400);
        });

        it('should 400 if a deserializer returns a promise rejected with a SchemaError',
           function () {
            app.get('/testrejectvalidationdeserializer', rest(function () {
                return { item: 'value' };
            }, { deserializer: function () {
                return Promise.reject(new Error(new Errors.SchemaError('test')));
            } }));

            return helper.request(TESTURL).get('/testrejectvalidationdeserializer')
                .expect('Content-Type', /^application\/json/)
                .expect(400);
        });

        it('should get a deserializer from the injector', function () {
            app.post('/testinjectdeserializer', rest(function (req) {
                expect(req.body).to.have.property('value').that.equals('asdf');
                return {
                    value: req.body.value
                };
            }, { deserializer: 'MockSerializable' }));

            return helper.request(TESTURL).post('/testinjectdeserializer')
                .send({ value: 'asdf' })
                .expect('Content-Type', /^application\/json/)
                .expect(200, { value: 'asdf' });
        });

        it('should 500 if a deserializer from the injector throws an Error',
           function () {
            app.post('/testinjectdeserializervalidationfail', rest(function () {
                return {};
            }, { deserializer: 'ThrowSerializable' }));

            return helper.request(TESTURL).post('/testinjectdeserializervalidationfail')
                .send({ value: 'asfd' })
                .expect('Content-Type', /^application\/json/)
                .expect(500)
                .expect(function (req) {
                    expect(req.body).to.have.property('message').that.equals('deserialize');
                });
        });

        it('should get a serializer from the injector', function () {
            app.post('/testinjectserializer', rest(function (req) {
                expect(req.body).to.have.property('value').that.equals('asdf');
                return req.body;
            }, { serializer: 'MockSerializable' }));

            return helper.request(TESTURL).post('/testinjectserializer')
                .send({ value: 'asdf' })
                .expect('Content-Type', /^application\/json/)
                .expect(200, { value: 'asdf' });
        });

        it('should 500 if a serializer from the injector throws an Error',
           function () {
            app.post('/testinjectserializerfail', rest(function (req) {
                return req.body;
            }, { serializer: 'ThrowSerializable' }));

            return helper.request(TESTURL).post('/testinjectserializerfail')
                .send({ val: 'asfd' })
                .expect('Content-Type', /^application\/json/)
                .expect(500)
                .expect(function (req) {
                    expect(req.body).to.have.property('message').that.equals('serialize');
                });
        });
    });
});
