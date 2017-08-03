// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Redfish Endpoint', function () {
    var tv4;
    var redfish;
    var validator;
    var fs;
    var Promise;
    var view;
    var systemUuid;

    // Skip reading the entry from Mongo and return the entry directly
    function redirectGet(entry) {
        return fs.readFileAsync(__dirname + '/../../../../data/views/redfish-1.0/' + entry, 'utf-8')
            .then(function(contents) {
                return { contents: contents };
            });
    }

    helper.httpServerBefore();

    before(function() {
        redfish = helper.injector.get('Http.Api.Services.Redfish');
        validator = helper.injector.get('Http.Api.Services.Schema');
        view = helper.injector.get('Views');
        Promise = helper.injector.get('Promise');
        var nodeFs = helper.injector.get('fs');
        fs = Promise.promisifyAll(nodeFs);
        systemUuid = helper.injector.get('SystemUuid');
        tv4 = require('tv4');
    });

    beforeEach('set up mocks', function () {
        this.sandbox.spy(tv4, "validate");
        this.sandbox.spy(redfish, 'render');
        this.sandbox.spy(validator, 'validate');
        this.sandbox.stub(view, "get", redirectGet);
        this.sandbox.stub(systemUuid, 'getUuid');
    });

    helper.httpServerAfter();

    it('should return a valid service root', function () {
        systemUuid.getUuid.resolves('66ddf9c7-a3a4-47fc-b603-60737d1f15a8');
        return helper.request().get('/redfish/v1')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(resp) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
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
