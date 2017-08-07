// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Config v2.0', function () {
    var configuration;

    helper.httpServerBefore();

    before(function () {
        configuration = helper.injector.get('Services.Configuration');
    });

    beforeEach('set up mocks', function() {
        this.sandbox.stub(configuration, 'set').returns(configuration);
        this.sandbox.stub(configuration, 'getAll').returns({});
    });

    helper.httpServerAfter();

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
