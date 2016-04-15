// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Tags', function () {
    var configuration;
    var lookupService;
    var workflowApiService;
    var Promise;
    var Errors;
    var nodesApi;
    var tagsApi;

    before('start HTTP server', function () {
        this.timeout(10000);
        return helper.startServer([
        ]).then(function () {
            configuration = helper.injector.get('Services.Configuration');
            lookupService = helper.injector.get('Services.Lookup');
            lookupService.ipAddressToMacAddress = sinon.stub().resolves();
            lookupService.ipAddressToNodeId = sinon.stub().resolves();
            sinon.stub(configuration);

            workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
            sinon.stub(workflowApiService);

            Promise = helper.injector.get('Promise');
            Errors = helper.injector.get('Errors');
            nodesApi = helper.injector.get('Http.Services.Api.Nodes');
            tagsApi = helper.injector.get('Http.Services.Api.Tags');
        });

    });

    beforeEach('reset stubs', function () {
        function resetStubs(obj) {
            _(obj).methods().forEach(function (method) {
                if (obj[method] && obj[method].reset) {
                  obj[method].reset();
                }
            }).value();
        }

        resetStubs(configuration);
        resetStubs(lookupService);
        resetStubs(workflowApiService);

        lookupService = helper.injector.get('Services.Lookup');
        lookupService.ipAddressToMacAddress = sinon.stub().resolves();
        lookupService.ipAddressToNodeId = sinon.stub().resolves();
    });

    after('stop HTTP server', function () {
        return helper.stopServer();
    });

    var input = {
        name: 'tag-name',
        rules: [
            {
                path: 'dmi.dmi.base_board.manufacturer',
                contains: 'Intel'
            },
            {
                path: 'dmi.memory.total',
                equals: '32946864kB'
            }
        ]
    };

    describe('2.0 Tags', function() {
        before(function() {
            sinon.stub(tagsApi, 'findTags');
            sinon.stub(tagsApi, 'getTag');
            sinon.stub(tagsApi, 'destroyTag');
            sinon.stub(tagsApi, 'createTag');
            sinon.stub(tagsApi, 'regenerateTags');
        });

        beforeEach(function() {
            tagsApi.findTags.reset().resolves([input]);
            tagsApi.getTag.reset().resolves(input);
            tagsApi.destroyTag.reset().resolves([]);
            tagsApi.createTag.reset().resolves([]);
            tagsApi.regenerateTags.reset().resolves();
        });

        after(function() {
            tagsApi.findTags.restore();
            tagsApi.getTag.restore();
            tagsApi.destroyTag.restore();
            tagsApi.createTag.restore();
            tagsApi.regenerateTags.restore();
        });

        it('should create a tag', function() {
            tagsApi.findTags.resolves([]);
            return helper.request().post('/api/2.0/tags')
                .send(input)
                .expect('Content-Type', /^application\/json/)
                .expect(201)
                .then(function (req) {
                    var tag = req.body;
                    expect(tag).to.have.property('name').that.equals(input.name);
                    expect(tag).to.have.property('rules').that.deep.equals(input.rules);
                    expect(tagsApi.createTag).to.have.been.calledOnce;
                    expect(tagsApi.regenerateTags).to.have.been.calledOnce;
                });
        });

        it('should 409 creating a tag that already exists', function() {
            return helper.request().post('/api/2.0/tags')
                .send(input)
                .expect(409);
        });

        it('should get tags', function() {
            return helper.request().get('/api/2.0/tags')
                .expect('Content-Type', /^application\/json/)
                .expect(200, [input]);
        });

        it('should return a tag from GET /tags/:id', function () {
            return helper.request().get('/api/2.0/tags/tag-name')
                .expect('Content-Type', /^application\/json/)
                .expect(200, input);
        });

        it('should return a tag from GET /tags/:id with special characters', function () {
            return helper.request().get('/api/2.0/tags/tag name')
                .expect('Content-Type', /^application\/json/)
                .expect(200, input)
                .then(function() {
                    expect(tagsApi.getTag).to.have.been.calledWith('tag%20name');
                });
        });

        it('should 404 an invalid GET /tags/:id', function () {
            tagsApi.getTag.resetBehavior();
            tagsApi.getTag.rejects(new Errors.NotFoundError());
            return helper.request().get('/api/2.0/tags/bad-tag-name')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });

        it('should destroy a tag', function() {
            return helper.request().delete('/api/2.0/tags/tag-name')
                .expect(204);
        });

        it('should 404 an invalid tag', function() {
            tagsApi.getTag.resetBehavior();
            tagsApi.getTag.rejects(new Errors.NotFoundError());
            return helper.request().delete('/api/2.0/tags/bad-tag-name')
                .expect(204);
        });
    });
});
