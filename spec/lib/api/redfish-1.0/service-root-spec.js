// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Redfish Endpoint', function () {
    var configuration;
    var tv4;
    var validator;
    var fs;
    var Promise;
    var template;

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
            validator = helper.injector.get('Http.Api.Services.Redfish');
            sinon.spy(validator, 'validate');
            sinon.spy(validator, 'render');
            template = helper.injector.get('Templates');
            sinon.stub(template, "get", redirectGet);
            Promise = helper.injector.get('Promise');
            var nodeFs = helper.injector.get('fs');
            fs = Promise.promisifyAll(nodeFs);
        });
    });

    beforeEach('set up mocks', function () {
        tv4 = require('tv4');
        sinon.spy(tv4, "validate");

        validator.validate.reset();
        validator.render.reset();
    });

    afterEach('tear down mocks', function () {
        tv4.validate.restore();
    });

    after('stop HTTP server', function () {
        validator.validate.restore();
        validator.render.restore();
        template.get.restore();
        return helper.stopServer();
    });

    it('should return a valid service root', function () {
        return helper.request().get('/redfish/v1')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(resp) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(validator.render.called).to.be.true;
                expect(resp.body.Systems).to.be.an('object');
                expect(resp.body.Chassis).to.be.an('object');
                expect(resp.body.Managers).to.be.an('object');
                expect(resp.body.Tasks).to.be.an('object');
                expect(resp.body.SessionService).to.be.an('object');
                expect(resp.body.AccountService).to.be.an('object');
                expect(resp.body.EventService).to.be.an('object');
            });
    });

});
