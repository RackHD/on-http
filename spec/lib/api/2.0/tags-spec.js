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

    helper.httpServerBefore();

    before(function () {
        configuration = helper.injector.get('Services.Configuration');
        lookupService = helper.injector.get('Services.Lookup');
        workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
        Promise = helper.injector.get('Promise');
        Errors = helper.injector.get('Errors');
        nodesApi = helper.injector.get('Http.Services.Api.Nodes');
        tagsApi = helper.injector.get('Http.Services.Api.Tags');
    });

    beforeEach('set up mocks', function() {
        lookupService.ipAddressToMacAddress = this.sandbox.stub().resolves();
        lookupService.ipAddressToNodeId = this.sandbox.stub().resolves();
        this.sandbox.stub(configuration);
        this.sandbox.stub(workflowApiService);
    });

    helper.httpServerAfter();

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
        beforeEach(function() {
            this.sandbox.stub(tagsApi, 'findTags').resolves([input]);
            this.sandbox.stub(tagsApi, 'getTag').resolves(input);
            this.sandbox.stub(tagsApi, 'destroyTag').resolves([]);
            this.sandbox.stub(tagsApi, 'createTag').resolves([]);
            this.sandbox.stub(tagsApi, 'regenerateTags');
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
                .expect(200)
                .then(function (res) {
                    var tag = res.body[0];
                    expect(tag).to.have.property('name').that.equals(input.name);
                    expect(tag).to.have.property('rules').that.deep.equals(input.rules);
                });
        });

        it('should return a tag from GET /tags/:id', function () {
            return helper.request().get('/api/2.0/tags/tag-name')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .then(function(res) {
                    var tag = res.body;
                    expect(tag).to.have.property('name').that.equals(input.name);
                    expect(tag).to.have.property('rules').that.deep.equals(input.rules);
                });
        });

        it('should return a tag from GET /tags/:id with special characters', function () {
            return helper.request().get('/api/2.0/tags/tag name')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .then(function(res) {
                    var tag = res.body;
                    expect(tagsApi.getTag).to.have.been.calledWith('tag name');
                    expect(tag).to.have.property('name').that.equals(input.name);
                    expect(tag).to.have.property('rules').that.deep.equals(input.rules);
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

        describe('POST /tags/:tagName/nodes/workflows', function() {
            it('should support specify workflow name via body', function() {
                this.sandbox.stub(nodesApi, 'getNodesByTag').withArgs('tag001').resolves([
                    { id: 'nodeId1' },
                    { id: 'nodeId2' }
                ]);
                this.sandbox.stub(nodesApi, 'setNodeWorkflow')
                    .onFirstCall().resolves({ id: 'graphId1' })
                    .onSecondCall().resolves({ id: 'graphId2' });
                return helper.request()
                    .post('/api/2.0/tags/tag001/nodes/workflows')
                    .send({ name: 'Graph.test', domain: 'test', options: { test: true} })
                    .expect('Content-Type', /^application\/json/)
                    .expect(202, [ {id: 'graphId1'}, {id: 'graphId2'}])
                    .then(function() {
                        expect(nodesApi.getNodesByTag).to.be.calledWith('tag001');
                        expect(nodesApi.setNodeWorkflow).to.be.calledTwice;
                        expect(nodesApi.setNodeWorkflow.firstCall).to.be.calledWith(
                            {name: 'Graph.test', domain: 'test', options: { test: true } },
                            'nodeId1' );
                        expect(nodesApi.setNodeWorkflow.secondCall).to.be.calledWith(
                            {name: 'Graph.test', domain: 'test', options: { test: true } },
                            'nodeId2' );
                    });
            });

            it('should support specify workflow name via query', function() {
                this.sandbox.stub(nodesApi, 'getNodesByTag').withArgs('tag001').resolves([
                    { id: 'nodeId1' },
                    { id: 'nodeId2' }
                ]);
                this.sandbox.stub(nodesApi, 'setNodeWorkflow')
                    .onFirstCall().resolves({ id: 'graphId1' })
                    .onSecondCall().resolves({ id: 'graphId2' });
                return helper.request()
                    .post('/api/2.0/tags/tag001/nodes/workflows?name=Graph.test')
                    .send({ domain: 'test',  options: { test: true} })
                    .expect('Content-Type', /^application\/json/)
                    .expect(202, [ {id: 'graphId1'}, {id: 'graphId2'}])
                    .then(function() {
                        expect(nodesApi.getNodesByTag).to.be.calledWith('tag001');
                        expect(nodesApi.setNodeWorkflow).to.be.calledTwice;
                        expect(nodesApi.setNodeWorkflow.firstCall).to.be.calledWith(
                            {name: 'Graph.test', domain: 'test', options: { test: true } },
                            'nodeId1' );
                        expect(nodesApi.setNodeWorkflow.secondCall).to.be.calledWith(
                            {name: 'Graph.test', domain: 'test', options: { test: true } },
                            'nodeId2' );
                    });
            });

            it('should succeed if no nodes are binded with tag', function() {
                this.sandbox.stub(nodesApi, 'getNodesByTag').withArgs('tag001').resolves([]);
                this.sandbox.stub(nodesApi, 'setNodeWorkflow').resolves({id: 'graphId'});
                return helper.request()
                    .post('/api/2.0/tags/tag001/nodes/workflows')
                    .send({ name: 'Graph.test', options: { test: true} })
                    .expect('Content-Type', /^application\/json/)
                    .expect(202)
                    .then(function() {
                        expect(nodesApi.getNodesByTag).to.be.calledWith('tag001');
                        expect(nodesApi.setNodeWorkflow).to.not.be.called;
                    });
            });

            it('should 404 if tag name is not existing', function() {
                this.sandbox.stub(nodesApi, 'getNodesByTag').withArgs('tag001')
                    .rejects(new Errors.NotFoundError('fail to find tag with name tag001'));
                return helper.request()
                    .post('/api/2.0/tags/tag001/nodes/workflows')
                    .send({ name: 'Graph.test', options: { test: true} })
                    .expect(404);
            });

            it('should 400 if run workflow fails for first node', function() {
                this.sandbox.stub(nodesApi, 'getNodesByTag').withArgs('tag001').resolves([
                    { id: 'nodeId1' },
                    { id: 'nodeId2' }
                ]);
                this.sandbox.stub(nodesApi, 'setNodeWorkflow')
                    .onFirstCall().rejects(new Error('graph error'))
                    .onSecondCall().resolves({ id: 'graphId2' });
                return helper.request()
                    .post('/api/2.0/tags/tag001/nodes/workflows')
                    .send({ name: 'Graph.test', options: { test: true} })
                    .expect(400);
            });

            it('should 400 if run workflow fails for second node', function() {
                this.sandbox.stub(nodesApi, 'getNodesByTag').withArgs('tag001').resolves([
                    { id: 'nodeId1' },
                    { id: 'nodeId2' }
                ]);
                this.sandbox.stub(nodesApi, 'setNodeWorkflow')
                    .onFirstCall().resolves({ id: 'graphId1' })
                    .onSecondCall().rejects(new Error('graph error'));
                return helper.request()
                    .post('/api/2.0/tags/tag001/nodes/workflows')
                    .send({ name: 'Graph.test', options: { test: true} })
                    .expect(400);
            });
        });
    });
});
