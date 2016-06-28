// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Config v2.0', function () {
    var configuration;
    before('start HTTP server', function () {
        this.timeout(10000);
        return helper.startServer().then(function() {
            configuration = helper.injector.get('Services.Configuration');
            sinon.stub(configuration, 'set').returns(configuration);
            sinon.stub(configuration, 'getAll').returns({});
        });
    });

    afterEach('tear down mocks', function () {
        configuration.set.reset();
        configuration.getAll.reset();
    });

    after('stop HTTP server', function () {
        configuration.set.restore();
        configuration.getAll.restore();
        return helper.stopServer();
    });

    it('should return configuration', function () {
        return helper.request().get('/api/2.0/config')
            .expect('Content-Type', /^application\/json/)
            .expect(200, {})
            .expect(function () {
                expect(configuration.getAll).to.have.been.calledOnce;
            });
    });

    it('should edit configuration', function () {
        return helper.request().patch('/api/2.0/config')
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
