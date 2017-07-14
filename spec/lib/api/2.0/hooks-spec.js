// Copyright 2017, Dell EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Hooks v2.0', function () {
    var hookService, Errors, _, hookPayload;
    var hookSample = [{
        url: "http://x.x.x.x",
        name: "test",
        id: "testid",
        filters: []
    }];

    helper.httpServerBefore();

    before(function () {
        hookService = helper.injector.get('Http.Services.Api.Hooks');
        Errors = helper.injector.get('Errors');
        _ = helper.injector.get('_');
        hookPayload = _.omit(hookSample[0], 'id');
    });

    helper.httpServerAfter();

    it('should return hooks', function () {
        var hookList = _.cloneDeep(hookSample);
        this.sandbox.stub(hookService, 'getHooks').resolves(hookList);
        return helper.request()
            .get('/api/2.0/hooks')
            .expect('Content-Type', /^application\/json/)
            .expect(200, hookSample)
            .expect(function () {
                expect(hookService.getHooks).to.have.been.calledOnce;
                expect(hookService.getHooks).to.have.been.calledWith({});
            });
    });

    it('should return hook by id', function () {
        var hook = _.cloneDeep(hookSample[0]);
        this.sandbox.stub(hookService, 'getHookById').resolves(hook);
        return helper.request()
            .get('/api/2.0/hooks/test')
            .expect('Content-Type', /^application\/json/)
            .expect(200, hookSample[0])
            .expect(function () {
                expect(hookService.getHookById).to.have.been.calledOnce;
                expect(hookService.getHookById).to.have.been.calledWith('test');
            });
    });

    it('should post new hooks', function () {
        var hookList = _.cloneDeep(hookSample[0]);
        this.sandbox.stub(hookService, 'createHook').resolves(hookList);
        return helper.request()
            .post('/api/2.0/hooks')
            .send(hookPayload)
            .set('Content-Type', 'application/json')
            .expect('Content-Type', /^application\/json/)
            .expect(201)
            .expect(function (res) {
                expect(res.body).to.deep.equal(hookSample[0]);
                expect(hookService.createHook).to.have.been.calledOnce;
                expect(hookService.createHook).to.have.been.calledWith(hookPayload);
            });
    });

    it('should return 400 post new hooks without url', function () {
        var hookList = _.cloneDeep(hookSample[0]);
        var hookWithNoUrl = _.cloneDeep(hookList);
        delete hookWithNoUrl.url;
        this.sandbox.stub(hookService, 'createHook').resolves(hookList);
        return helper.request()
            .post('/api/2.0/hooks')
            .send(hookWithNoUrl)
            .set('Content-Type', 'application/json')
            .expect(400);
    });

    it('should throw 400 with bad request error', function () {
        this.sandbox.stub(hookService, 'createHook').rejects(new Errors.BadRequestError());
        return helper.request()
            .post('/api/2.0/hooks')
            .send({})
            .expect(400)
            .expect(function () {
                expect(hookService.createHook).to.have.not.been.called;
            });
    });

    it('should patch hook', function () {
        var hookList = _.cloneDeep(hookSample[0]);
        this.sandbox.stub(hookService, 'updateHookById').resolves(hookList);
        return helper.request()
            .patch('/api/2.0/hooks/test')
            .send(hookPayload)
            .set('Content-Type', 'application/json')
            .expect('Content-Type', /^application\/json/)
            .expect(200, hookSample[0])
            .expect(function () {
                expect(hookService.updateHookById).to.have.been.calledOnce;
                expect(hookService.updateHookById).to.have.been.calledWith('test', hookPayload);
            });
    });

    it('should delete hook', function () {
        this.sandbox.stub(hookService, 'deleteHookById').resolves(hookSample);
        return helper.request()
            .delete('/api/2.0/hooks/test')
            .expect(204)
            .expect(function () {
                expect(hookService.deleteHookById).to.have.been.calledOnce;
                expect(hookService.deleteHookById).to.have.been.calledWith('test');
            });
    });

    it('should return a 404 if the hook was not found', function () {
        this.sandbox.stub(hookService, 'deleteHookById')
            .rejects(new Errors.NotFoundError('Not Found'));
        return helper.request()
            .delete('/api/2.0/hooks/test')
            .expect(404);
    });
});
