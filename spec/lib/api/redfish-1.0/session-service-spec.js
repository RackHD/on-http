// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Redfish Session Service', function () {
    var tv4;
    var validator;
    var redfish;
    var waterline;
    var Promise;
    var Constants;
    var template;
    var fs;

    // Skip reading the entry from Mongo and return the entry directly
    function redirectGet(entry) {
        return fs.readFileAsync(__dirname + '/../../../../data/templates/' + entry, 'utf-8')
            .then(function(contents) {
                return { contents: contents };
            });
    }

    before('start HTTP server', function () {
        this.timeout(5000);

        return helper.startServer([]).then(function () {
            Constants = helper.injector.get('Constants');

            template = helper.injector.get('Templates');
            sinon.stub(template, "get", redirectGet);

            redfish = helper.injector.get('Http.Api.Services.Redfish');
            sinon.spy(redfish, 'render');

            validator = helper.injector.get('Http.Api.Services.Schema');
            sinon.spy(validator, 'validate');

            waterline = helper.injector.get('Services.Waterline');
            sinon.stub(waterline.graphobjects);
            sinon.stub(waterline.nodes);
            sinon.stub(waterline.localusers, 'findOne');
            waterline.localusers.findOne.withArgs({username: 'admin'}).resolves({
                username: 'admin',
                comparePassword: function(password) { return password === 'admin123'; }
            });
            waterline.localusers.findOne.resolves();

            Promise = helper.injector.get('Promise');

            var nodeFs = helper.injector.get('fs');
            fs = Promise.promisifyAll(nodeFs);

            helper.injector.get('Auth.Services').init();
        });
    });

    beforeEach('set up mocks', function () {
        tv4 = require('tv4');
        sinon.spy(tv4, "validate");

        validator.validate.reset();
        redfish.render.reset();

        function resetStubs(obj) {
            _(obj).methods().forEach(function (method) {
                if (obj[method] && obj[method].reset) {
                  obj[method].reset();
                }
            }).value();
        }

        resetStubs(waterline.graphobjects);
        resetStubs(waterline.nodes);
    });

    afterEach('tear down mocks', function () {
        tv4.validate.restore();
    });

    after('stop HTTP server', function () {
        validator.validate.restore();
        redfish.render.restore();
        template.get.restore();

        function restoreStubs(obj) {
            _(obj).methods().forEach(function (method) {
                if (obj[method] && obj[method].restore) {
                  obj[method].restore();
                }
            }).value();
        }

        restoreStubs(waterline.graphobjects);
        restoreStubs(waterline.nodes);
        waterline.localusers.findOne.restore();
        return helper.stopServer();
    });

    it('should return a valid session service root', function () {
        return helper.request().get('/redfish/v1/SessionService')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should return a valid session collection', function() {
        return helper.request().get('/redfish/v1/SessionService/Sessions')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    describe('session login', function() {
        var id;
        beforeEach('create a session object', function() {
            return helper.request().post('/redfish/v1/SessionService/Sessions')
                .send({UserName: 'admin', Password: 'admin123'})
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function(res) {
                    expect(res.headers).to.have.property('x-auth-token');
                    expect(res.body.UserName).to.equal('admin');
                    id = res.body.Id;
                });
        });

        afterEach('delete session object', function() {
            return helper.request().delete('/redfish/v1/SessionService/Sessions/' + id)
                .expect(204);
        });

        it('should return the session', function () {
            return helper.request().get('/redfish/v1/SessionService/Sessions/' + id)
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function() {
                    expect(tv4.validate.called).to.be.true;
                    expect(validator.validate.called).to.be.true;
                    expect(redfish.render.called).to.be.true;
                });
        });

        it('should 404 an invalid session', function() {
            return helper.request().get('/redfish/v1/SessionService/Sessions/' + id + 'invalid')
                .expect(404);
        });

        it('should list the session', function() {
            return helper.request().get('/redfish/v1/SessionService/Sessions')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function(res) {
                    expect(tv4.validate.called).to.be.true;
                    expect(validator.validate.called).to.be.true;
                    expect(redfish.render.called).to.be.true;
                    expect(res.body['Members@odata.count']).to.equal(1);
                    expect(res.body.Members[0]['@odata.id'])
                        .to.equal('/redfish/v1/SessionService/Sessions/' + id);
                    });
        });
    });
});

