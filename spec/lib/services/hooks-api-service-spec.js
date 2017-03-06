// Copyright 2017, Dell EMC, Inc.

'use strict';

describe('Http.Services.Api.Hooks', function () {
    var Errors;
    var hooksApiService;
    var waterline;
    var body = {url: '0.0.0.0', filters: [{nodeId: 'nodeId'}]};
    var hook = {url: '0.0.0.0', id: 'hookId'};
    var _;
    
    before('Http.Services.Api.Hooks before', function() {
        this.sandbox = sinon.sandbox.create();
        helper.setupInjector([
            onHttpContext.prerequisiteInjectables,
            helper.require('/lib/services/hooks-api-service')
        ]);
        hooksApiService = helper.injector.get('Http.Services.Api.Hooks');
        Errors = helper.injector.get('Errors');
        waterline = helper.injector.get('Services.Waterline');
        waterline.hooks = {
            find: function(){},
            findOne: function(){},
            create: function(){},
            update: function(){},
            destroyByIdentifier: function(){},
            updateByIdentifier: function(){}
        };
        _ = helper.injector.get('_');
    });

    afterEach('Http.Services.Api.Profiles afterEach', function() {
        this.sandbox.restore();
    });

    it('should find hooks', function () {
        var query = {query: 'test'};
        this.sandbox.stub(waterline.hooks, 'find').resolves([]);
        return hooksApiService.getHooks(query)
        .then(function() {
            expect(waterline.hooks.find).to.be.calledOnce;
            expect(waterline.hooks.find).to.be.calledWith(query);
        });
    });

    it('should find hook by id', function () {
        var query = {id: 'id'};
        this.sandbox.stub(waterline.hooks, 'findOne').resolves(hook);
        return hooksApiService.getHookById('id')
        .then(function() {
            expect(waterline.hooks.findOne).to.be.calledOnce;
            expect(waterline.hooks.findOne).to.be.calledWith(query);
        });
    });

    it('should create hooks if hook url does not exist', function () {
        this.sandbox.stub(waterline.hooks, 'findOne').resolves({});
        this.sandbox.stub(waterline.hooks, 'create').resolves(hook);
        return hooksApiService.createHook(body)
        .then(function(result) {
            expect(waterline.hooks.findOne).to.be.calledOnce;
            expect(waterline.hooks.findOne).to.be.calledWith({url: body.url});
            expect(waterline.hooks.create).to.be.calledOnce;
            expect(waterline.hooks.create).to.be.calledWith(body);
            expect(result).to.be.deep.equal(hook);
        });
    });

    it('should throw error if hook url string is not a url', function (done) {
        return hooksApiService.createHook({url: 'abcd'})
        .then(function() {
            done(new Error('Test should fail'));
        })
        .catch(function(err){
            expect(err.name).equals('AssertionError');
            done();
        });
    });

    it('should throw errors if hook exists', function (done) {
        var existingHook = _.defaults(body, {id: 'test'});
        this.sandbox.stub(waterline.hooks, 'findOne').resolves(existingHook);
        return hooksApiService.createHook(body)
        .then(function(){
            done(new Error("test should fail"));
        })
        .catch(function(err){
            expect(waterline.hooks.findOne).to.be.calledOnce;
            expect(waterline.hooks.findOne).to.be.calledWith({url: body.url});
            expect(err.status).equals(409);
            expect(err.message).equals('duplicate hook found');
            expect(err.name).equals('BaseError');
            done();
        });
    });
    
    it('should delete hook by id', function () {
        var id = 'testId';
        this.sandbox.stub(waterline.hooks, 'destroyByIdentifier').resolves();
        return hooksApiService.deleteHookById(id)
        .then(function() {
            expect(waterline.hooks.destroyByIdentifier).to.be.calledOnce;
            expect(waterline.hooks.destroyByIdentifier).to.be.calledWith(id);
        });
    });
    
    it('should delete update hook by id', function () {
        var id = 'testId';
        this.sandbox.stub(waterline.hooks, 'updateByIdentifier').resolves(hook);
        return hooksApiService.updateHookById(id, body)
        .then(function(ret) {
            expect(waterline.hooks.updateByIdentifier).to.be.calledOnce;
            expect(waterline.hooks.updateByIdentifier).to.be.calledWith(id, body);
            expect(ret).deep.equals(hook);
        });
    });
});
