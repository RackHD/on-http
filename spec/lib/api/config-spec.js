// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Config', function () {
    before('start HTTP server', function () {
        this.timeout(5000);
        return helper.startServer();
    });

    after('stop HTTP server', function () {
        return helper.stopServer();
    });

    it('should return configuration', function () {
        var configuration = helper.injector.get('Services.Configuration');
        return helper.request().get('/api/1.1/config')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function (res) {
                expect(res.body).to.deep.equal(configuration.getAll());
            });
    });

    it('should edit configuration', function () {
        var configuration = helper.injector.get('Services.Configuration');
        return helper.request().patch('/api/1.1/config')
            .send({ dummySetting: 'magic' })
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function (res) {
                expect(res.body).to.have.property('dummySetting').that.equals('magic');
                expect(res.body).to.deep.equal(configuration.getAll());
            });
    });
});
