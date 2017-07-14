// Copyright 2016, EMC, Inc.
/* jshint node:true */
'use strict';

describe('Redfish Registries', function () {
    var tv4;
    var redfish;
    var validator;
    var fs;
    var Promise;
    var view;
    var env;

    // Skip reading the entry from Mongo and return the entry directly
    function redirectGet(entry) {
        return fs.readFileAsync(__dirname + '/../../../../data/views/redfish-1.0/' + entry, 'utf-8')
            .then(function (contents) {
                return {contents: contents};
            });
    }

    helper.httpServerBefore();

    before(function () {
        redfish = helper.injector.get('Http.Api.Services.Redfish');
        validator = helper.injector.get('Http.Api.Services.Schema');
        view = helper.injector.get('Views');
        Promise = helper.injector.get('Promise');
        var nodeFs = helper.injector.get('fs');
        fs = Promise.promisifyAll(nodeFs);
        env = helper.injector.get('Services.Environment');
        tv4 = require('tv4');
    });

    beforeEach('set up mocks', function () {
        this.sandbox.spy(tv4, "validateResult");
        this.sandbox.spy(redfish, 'render');
        this.sandbox.spy(validator, 'validate');
        this.sandbox.stub(view, "get", redirectGet);
        this.sandbox.stub(env, "get").resolves();
    });

    helper.httpServerAfter();

    it('should return a valid collection of registries', function() {
        return helper.request().get('/redfish/v1/Registries')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(tv4.validateResult.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
                expect(res.body['Members@odata.count']).to.equal(1);
                expect(res.body.Members[0]['@odata.id'])
                    .to.equal('/redfish/v1/Registries/Base.1.0.0');
            });
    });

    it('should return a valid registry ', function () {
        return helper.request().get('/redfish/v1/Registries/Base.1.0.0')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(tv4.validateResult.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
                expect(res.body).to.be.an('object').with.property('Registry', 'DSP8010_1.0.0');
                expect(res.body['@odata.id']).to.equal('/redfish/v1/Registries/Base.1.0.0');
            });
    });

    it('should 404 an invalid registry ', function () {
        return helper.request().get('/redfish/v1/Registries/Base.1.0.1')
            .expect('Content-Type', /^application\/json/)
            .expect(404)
            .expect(function(res) {
                expect(res.body.error).to.be.an('object');
                expect(res.body.error).to.be.an('object').with.property('code','Base.1.0.' +
                    'GeneralError');
            });
    });

    it('should 404 invalid registry contents ', function () {
        return helper.request().get('/redfish/v1/Registries/en/Base.1.0.1')
            .expect('Content-Type', /^application\/json/)
            .expect(404)
            .expect(function(res) {
                expect(res.body.error).to.be.an('object');
                expect(res.body.error).to.be.an('object').with.property('code','Base.1.0.' +
                    'GeneralError');
            });
    });

    it('should return registry contents ', function () {
        return helper.request().get('/redfish/v1/Registries/en/Base.1.0.0')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(res.body).to.be.an('object').with.property('Id', 'Base.1.0.0');
                expect(res.body.Messages).to.be.an('object');

            });
    });

});
