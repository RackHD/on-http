// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Redfish Schemas', function () {
    var tv4;
    var redfish;
    var validator;

    before('start HTTP server', function () {
        this.timeout(5000);
        return helper.startServer([]).then(function () {
            redfish = helper.injector.get('Http.Api.Services.Redfish');
            sinon.spy(redfish, 'render');

            validator = helper.injector.get('Http.Api.Services.Schema');
            sinon.spy(validator, 'validate');
        });
    });

    beforeEach('set up mocks', function () {
        tv4 = require('tv4');
        sinon.spy(tv4, "validate");

        validator.validate.reset();
        redfish.render.reset();

    });

    afterEach('tear down mocks', function () {
        tv4.validate.restore();
    });

    after('stop HTTP server', function () {
        validator.validate.restore();
        redfish.render.restore();
        
        return helper.stopServer();
    });

    it('should return valid schemas', function () {

        return helper.request().get('/redfish/v1/Schemas')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
                expect(res.body['Members@odata.count']).to.equal(89);
                
            });
    });

    it('should return valid AccountService.1.0.0 schema information ', function () {

        return helper.request().get('/redfish/v1/Schemas/AccountService.1.0.0')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
                expect(res.body.Id).to.equal("AccountService.1.0.0");
                expect(res.body.Location[0].Uri)
                    .to.equal("/redfish/v1/SchemaStore/en/AccountService.1.0.0" );
            });
    });

    it('should return 404 on invalid schema information ', function () {

        return helper.request().get('/redfish/v1/Schemas/AccountService.1.0.01')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should return 404 on invalid schema json', function () {

        return helper.request().get('/redfish/v1/SchemaStore/en/AccountService.1.0.01')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });


});
