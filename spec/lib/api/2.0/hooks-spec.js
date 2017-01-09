// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Hooks v2.0', function () {
    var hookService, Errors;
    var hookSample = [{
        url: "http://x.x.x.x",
        name: "test",
        filters: []
    }];
    var sandbox = sinon.sandbox.create();
    before('start HTTP server', function () {
        this.timeout(10000);
        return helper.startServer([])
        .then(function() {
            hookService = helper.injector.get('Http.Services.Api.Hooks');
            Errors = helper.injector.get('Errors');
        });
    });

    afterEach('tear down mocks', function () {
        sandbox.restore();
    });

    after('stop HTTP server', function () {
        return helper.stopServer();
    });

    it('should return hooks', function () {
        sandbox.stub(hookService, 'getHooks').resolves(hookSample);
        return helper.request()
            .get('/api/2.0/hooks')
            .expect('Content-Type', /^application\/json/)
            .expect(200, hookSample)
            .expect(function (res) {
                expect(hookService.getHooks).to.have.been.calledOnce;
                expect(hookService.getHooks).to.have.been.calledWith({});
            });
    });

    it('should post new hooks', function () {
        sandbox.stub(hookService, 'createHook').resolves(hookSample[0]);
        return helper.request()
            .post('/api/2.0/hooks')
            .send(hookSample[0])
            .set('Content-Type', 'application/json')
            .expect('Content-Type', /^application\/json/)
            .expect(201, hookSample[0])
            .expect(function () {
                expect(hookService.createHook).to.have.been.calledOnce;
                expect(hookService.createHook).to.have.been.calledWith(hookSample[0]);
            });
    });

    it('should throw 400 with bad request error', function () {
        sandbox.stub(hookService, 'createHook').rejects(new Errors.BadRequestError());
        return helper.request()
            .post('/api/2.0/hooks')
            .send({})
            .expect(400)
            .expect(function () {
                expect(hookService.createHook).to.have.not.been.called;
            });
    });

    it('should patch hook', function () {
        sandbox.stub(hookService, 'updateHookById').resolves(hookSample[0]);
        return helper.request()
            .patch('/api/2.0/hooks/test')
            .send(hookSample[0])
            .set('Content-Type', 'application/json')
            .expect('Content-Type', /^application\/json/)
            .expect(200, hookSample[0])
            .expect(function () {
                expect(hookService.updateHookById).to.have.been.calledOnce;
                expect(hookService.updateHookById).to.have.been.calledWith('test', hookSample[0]);
            });
    });

    it('should delete hook', function () {
        sandbox.stub(hookService, 'deleteHookById').resolves(hookSample);
        return helper.request()
            .delete('/api/2.0/hooks/test')
            .expect(204)
            .expect(function () {
                expect(hookService.deleteHookById).to.have.been.calledOnce;
                expect(hookService.deleteHookById).to.have.been.calledWith('test');
            });
    });

    it('should return a 404 if the hook was not found', function () {
        sandbox.stub(hookService, 'deleteHookById').rejects(new Errors.NotFoundError('Not Found'));
        return helper.request()
            .delete('/api/2.0/hooks/test')
            .expect(404);
    });
});
