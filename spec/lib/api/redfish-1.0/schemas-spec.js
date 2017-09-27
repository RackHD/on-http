// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Redfish Schemas', function () {
    var tv4;
    var redfish;
    var validator;
    var fs;
    var Promise;
    var fromRoot = process.cwd();

    helper.httpServerBefore();

    before(function () {
        redfish = helper.injector.get('Http.Api.Services.Redfish');
        validator = helper.injector.get('Http.Api.Services.Schema');
        Promise = helper.injector.get('Promise');
        fs = Promise.promisifyAll( helper.injector.get('fs') );
        tv4 = require('tv4');
    });

    beforeEach('set up mocks', function () {
        this.sandbox.spy(tv4, "validate");
        this.sandbox.spy(redfish, 'render');
        this.sandbox.spy(validator, 'validate');
    });

    helper.httpServerAfter();

    it('should return valid schemas', function () {

        return helper.request().get('/redfish/v1/JsonSchemas')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
                expect(res.body['Members@odata.count']).to.equal(236);

            });
    });

    it('should return valid AccountService schema information ', function () {

        return helper.request().get('/redfish/v1/JsonSchemas/AccountService.v1_1_0')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
                expect(res.body.Id).to.equal("AccountService.v1_1_0");
                expect(res.body.Location[0].Uri)
                    .to.equal("/redfish/v1/SchemaStore/en/AccountService.v1_1_0" );
            });
    });

    it('should return valid xml schema information ', function () {
        return Promise.resolve()
            .then(function(){
                return fs.readFileAsync(fromRoot + '/static/DSP8010_2016.3/metadata/Bios_v1.xml', 'utf8');
            })
            .then(function(fileContent){
                return helper.request().get('/redfish/v1/JsonSchemas/Bios_v1.xml')
                    .expect('Content-Type', "application/xml; charset=utf-8")
                    .expect(200)
                    .expect(function(res) {
                        expect(res.text).to.equal(fileContent);
                    });
            });

    });

    it('should return invalid xml schema information ', function () {
        return Promise.resolve()
            .then(function(){
                return helper.request().get('/redfish/v1/JsonSchemas/invallid.xml');
            })
            .then(function(done){
                done(new Error('should have Failed!'));
            })
            .catch(function (e) {
                expect(e).to.have.property('message');// jshint ignore:line
            });

    });


    it('should return 404 on invalid schema information ', function () {

        return helper.request().get('/redfish/v1/JsonSchemas/AccountService.1.0.01')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should return 404 on invalid schema json', function () {

        return helper.request().get('/redfish/v1/SchemaStore/en/AccountService.1.0.01')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

});
