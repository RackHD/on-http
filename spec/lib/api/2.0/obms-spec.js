// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Obms', function () {
    before('start HTTP server', function () {
        this.timeout(5000);
        return helper.startServer();
    });

    beforeEach('reset test DB', function () {
        return helper.reset();
    });

    after('stop HTTP server', function () {
        return helper.stopServer();
    });

    it('should return a list of obm service types', function () {
        return helper.request().get('/api/2.0/obms/library')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function (res) {
                expect(res.body).to.be.an.instanceOf(Array);
                res.body.forEach(function (obm, index) {
                    expect(res.body).to.have.deep.property('[' + index + '].service')
                        .that.is.a('string');
                    expect(res.body).to.have.deep.property('[' + index + '].config')
                        .that.is.an('object');
                });
            });
    });

    it('should get the ipmi obm service type', function () {
        return helper.request().get('/api/2.0/obms/library/ipmi-obm-service')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function (res) {
                expect(res.body).to.have.property('service').that.equals('ipmi-obm-service');
                expect(res.body).to.have.property('config').that.is.an('object');
            });
    });

    it('should get the panduit obm service type', function () {
        return helper.request().get('/api/2.0/obms/library/panduit-obm-service')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function (res) {
                expect(res.body).to.have.property('service').that.equals('panduit-obm-service');
                expect(res.body).to.have.property('config').that.is.an('object');
            });

    });
});
