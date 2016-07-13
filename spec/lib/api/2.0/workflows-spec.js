// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Workflows.2.0', function () {
    var waterline;
    var Errors;
    var workflowApiService;
    var arpCache = {
        getCurrent: sinon.stub().resolves([])
    };
    var views;

    before('start HTTP server', function () {
        var self = this;
        this.timeout(10000);

        waterline = {
            start: sinon.stub(),
            stop: sinon.stub(),
            lookups: {
                setIndexes: sinon.stub()
            }
        };
        this.sandbox = sinon.sandbox.create();

        return helper.startServer([
            dihelper.simpleWrapper(waterline, 'Services.Waterline'),
            dihelper.simpleWrapper(arpCache, 'ARPCache')
        ])
        .then(function() {
            Errors = helper.injector.get('Errors');
            workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
            self.sandbox.stub(workflowApiService, 'defineTask').resolves();
            self.sandbox.stub(workflowApiService, 'getAllWorkflows').resolves();
            self.sandbox.stub(workflowApiService, 'createAndRunGraph').resolves();
            self.sandbox.stub(workflowApiService, 'getWorkflowByInstanceId').resolves();
            self.sandbox.stub(workflowApiService, 'cancelTaskGraph').resolves();
            self.sandbox.stub(workflowApiService, 'deleteTaskGraph').resolves();

            views = helper.injector.get('Views');
            self.sandbox.stub(views, 'render').resolves();
        });
    });

    beforeEach('set up mocks', function () {
        waterline.nodes = {
            findByIdentifier: sinon.stub().resolves()
        };
        waterline.graphobjects = {
            find: sinon.stub().resolves([]),
            findOne: sinon.stub().resolves(),
            findByIdentifier: sinon.stub().resolves(),
            needByIdentifier: sinon.stub().resolves()
        };
        waterline.lookups = {
            // This method is for lookups only and it
            // doesn't impact behavior whether it is a
            // resolve or a reject since it's related
            // to logging.
            findOneByTerm: sinon.stub().rejects()
        };
    });

    afterEach('clean up mocks', function () {
        this.sandbox.reset();
    });

    after('stop HTTP server', function () {
        this.sandbox.restore();
        return helper.stopServer();
    });

    describe('workflowsGet', function () {
        it('should return a list of persisted graph objects', function () {
            var graph = { name: 'foobar' };
            workflowApiService.getAllWorkflows.resolves([graph]);

            return helper.request().get('/api/2.0/workflows')
                .expect('Content-Type', /^application\/json/)
                .expect(200, [graph])
                .expect(function () {
                    expect(workflowApiService.getAllWorkflows).to.have.been.calledOnce;
                });
        });

        it('should return 404 if not found ', function () {
            workflowApiService.getAllWorkflows.rejects(new Errors.NotFoundError('test'));
            views.render.resolves('{"message": "error"}');

            return helper.request().get('/api/2.0/workflows')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });

    describe('workflowsPost', function () {
        it('should persist a task graph', function () {
            var graph = {
                             "friendlyName": "Catalog dmi",
                             "implementsTask": "Task.Base.Linux.Catalog",
                             "injectableName": "Task.Catalog.dmi",
                        };
            workflowApiService.createAndRunGraph.resolves(graph);

            return helper.request().post('/api/2.0/workflows')
                .send(graph)
                .expect('Content-Type', /^application\/json/)
                .expect(201)
                .expect(function (res ){
                    expect(res.body).to.have.property("friendlyName", "Catalog dmi");
                    expect(res.body).to.have.property("implementsTask", "Task.Base.Linux.Catalog");
                    expect(res.body).to.have.property("injectableName", "Task.Catalog.dmi");
                });
        });
    });

    describe('workflowsGetById', function () {
        it('should return a single persisted graph', function () {
            var graph = { id: 'foobar' };
            workflowApiService.getWorkflowByInstanceId.resolves(graph);

            return helper.request().get('/api/2.0/workflows/foobar')
                .expect('Content-Type', /^application\/json/)
                .expect(200, graph)
                .expect(function () {
                    expect(workflowApiService.getWorkflowByInstanceId).to.have.been.calledOnce;
                    expect(workflowApiService.getWorkflowByInstanceId)
                        .to.have.been.calledWith('foobar');
                });
        });

        it('should return a 404 if not found', function () {
            workflowApiService.getWorkflowByInstanceId.rejects(new Errors.NotFoundError('test'));
            views.render.resolves('{"message": "error"}');

            return helper.request().get('/api/2.0/workflows/12345')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });

    describe('workflowsAction', function () {
        it('should cancel a task', function () {
            var action = { command: 'cancel' };
            var graph = { instanceId: 'foobar',
                          _status: 'cancelled'
                        };

            workflowApiService.cancelTaskGraph.resolves(graph);
            return helper.request().put('/api/2.0/workflows/56e6ef601c3a31638be765fc/action')
                .set('Content-Type', 'application/json')
                .send(action)
                .expect(200)
                .expect(function() {
                    expect(workflowApiService.cancelTaskGraph).to.have.been.calledOnce;
                    expect(workflowApiService.cancelTaskGraph)
                         .to.have.been.calledWith('56e6ef601c3a31638be765fc');
                })
                .expect(function(res) {
                    expect(res.body).to.deep.equal(graph);
                });
        });
    });

   describe('workflowsDeleteById', function () {

        var workflow = {
                friendlyName: 'dummy',
                id: 'dummyId',
                state: 'running',
                instanceId: 'foo'
            };

        it('should delete the Task with DELETE /workflows/id', function () {
            return helper.request().delete('/api/2.0/workflows/'+ workflow.id)
                .expect(200)
                .expect(function() {
                    expect(workflowApiService.deleteTaskGraph).to.have.been.calledOnce;
                    expect(workflowApiService.deleteTaskGraph)
                         .to.have.been.calledWith(workflow.id);
                });
        });
    });
});
