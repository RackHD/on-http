// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Config', function () {
    var configuration;
    before('start HTTP server', function () {
        this.timeout(5000);
        return helper.startServer();
    });

    beforeEach('set up mocks', function () {
        configuration = helper.injector.get('Services.Configuration');
        sinon.stub(configuration, 'set').returns(configuration);
        sinon.stub(configuration, 'getAll').returns({});
    });

    afterEach('tear down mocks', function () {
        configuration.set.restore();
        configuration.getAll.restore();
    });

    after('stop HTTP server', function () {
        return helper.stopServer();
    });

    it('should return configuration', function () {
        return helper.request().get('/api/1.1/config')
            .expect('Content-Type', /^application\/json/)
            .expect(200, {})
            .expect(function () {
                expect(configuration.getAll).to.have.been.calledOnce;
            });
    });

    it('should edit configuration', function () {
        return helper.request().patch('/api/1.1/config')
            .send({ dummySetting: 'magic' })
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function () {
                expect(configuration.set).to.have.been.calledOnce;
                expect(configuration.set).to.have.been.calledWith('dummySetting', 'magic');
                expect(configuration.getAll).to.have.been.calledOnce;
            });
    });
});
