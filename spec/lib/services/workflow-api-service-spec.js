// Copyright © 2016-2017 Dell Inc. or its subsidiaries.  All Rights Reserved.

'use strict';

describe('Http.Services.Api.Workflows', function () {
    var Errors;
    var workflowApiService;
    var graph;
    var graphDefinition;
    var task;
    var taskDefinition;
    var store;
    var waterline;
    var env;
    var workflowDefinition;
    var workflow;
    var Promise;
    var TaskGraph;
    var taskGraphService;

    before('Http.Services.Api.Workflows before', function() {
        helper.setupInjector([
            onHttpContext.injectables,
            onHttpContext.prerequisiteInjectables
        ]);
        Errors = helper.injector.get('Errors');
        workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
        waterline = helper.injector.get('Services.Waterline');
        store = helper.injector.get('TaskGraph.Store');
        env = helper.injector.get('Services.Environment');
        Promise = helper.injector.get('Promise');
        TaskGraph = helper.injector.get('TaskGraph.TaskGraph');
        taskGraphService = helper.injector.get('Http.Services.Api.Taskgraph.Scheduler');

    });

    beforeEach(function() {
        waterline.nodes = {
            needByIdentifier: sinon.stub().resolves({ id: 'testnodeid' })
        };
        waterline.lookups = {
           findOneByTerm: sinon.stub().resolves()
        };
        waterline.graphobjects = {
            needOne: sinon.stub().resolves({ id: 'testgraphid', _status: 'pending' }),
            find: sinon.stub().resolves(),
            findOne: sinon.stub().resolves()
        };
        waterline.graphdefinitions = {
            destroy: sinon.stub().resolves({ injectableName: 'test' })
        };
        waterline.taskdefinitions = {
            destroy: sinon.stub().resolves({ injectableName: 'test' })
        };
        graph = { instanceId: 'testgraphid' };
        task = { instanceId: 'testtaskid' };
        workflow = { id: 'testid', _status: 'cancelled' };
        graphDefinition = { injectableName: 'Graph.Test' };
        taskDefinition = { injectableName: 'Task.Test' };
        workflowDefinition = { injectableName: 'Task.Test',
                               instanceId: 'testId',
                               id: 'testid',
                               _status: 'cancelled',
                               active: sinon.spy()
                              };
        this.sandbox = sinon.sandbox.create();
        this.sandbox.stub(env, 'get');
        this.sandbox.stub(taskGraphService, 'workflowsPost');
        this.sandbox.stub(taskGraphService, 'workflowsGet');
        this.sandbox.stub(taskGraphService, 'workflowsPutGraphs');
        this.sandbox.stub(taskGraphService, 'workflowsGetByInstanceId');
        this.sandbox.stub(taskGraphService, 'workflowsGetTasksByName');
        this.sandbox.stub(taskGraphService, 'workflowsDeleteGraphsByName');
        this.sandbox.stub(taskGraphService, 'workflowsPutTask');
        this.sandbox.stub(taskGraphService, 'workflowsAction');
        this.sandbox.stub(taskGraphService, 'workflowsDeleteTasksByName');
    });

    afterEach('Http.Services.Api.Profiles afterEach', function() {
        this.sandbox.restore();
    });

    it('should create and run a graph not against a node', function () {
        taskGraphService.workflowsPost.resolves(graphDefinition);

        graph = {
            instanceId: 'testgraphid',
            name: 'testGraph',
            node: null,
            tasks: {
                task1: {
                    state: 'pending'
                },
                task2: {
                    state: 'pending'
                }
            }
        };

        return workflowApiService.createAndRunGraph({
            name: 'Graph.Test',
            options: { test: 1 },
            context: { test: 2 },
            domain: 'test'
        })
        .then(function() {
            expect(taskGraphService.workflowsPost).to.have.been.calledOnce;
            expect(taskGraphService.workflowsPost).to.have.been.calledWith(
                {
                    name: 'Graph.Test',
                    options: { test: 1 },
                    context: { test: 2 },
                    domain: 'test'
                }
            );
        });
    });

    it('should create and run a graph against a node', function () {
        return workflowApiService.createAndRunGraph({
            name: 'Graph.Test',
            options: { test: 1 },
            context: { test: 2 },
            domain: 'test'
        }, 'testnodeid')
        .then(function() {
            expect(taskGraphService.workflowsPost).to.have.been.calledOnce;
            expect(taskGraphService.workflowsPost).to.have.been.calledWith(
                {
                    name: 'Graph.Test',
                    options: { test: 1 },
                    context: { test: 2 },
                    domain: 'test'
                },
                'testnodeid'
            );
        });
    });

    it('should throw error if the graph name is missing', function() {
        return expect(
            workflowApiService.createAndRunGraph({
                options: { test: 1 },
                context: { test: 2 },
                domain: 'test'
            }, 'testnodeid')
        ).to.be.rejectedWith(Errors.BadRequestError, /Graph name is missing or in wrong format/);
    });

    it('should throw error if the graph name is in wrong format', function() {
        return Promise.map([123, null, ''], function(name) {
            return expect(
                workflowApiService.createAndRunGraph({
                    name: name,
                    options: { test: 1 },
                    context: { test: 2 },
                    domain: 'test'
                }, 'testnodeid')
            ).to.be.rejectedWith(Errors.BadRequestError,
                /Graph name is missing or in wrong format/);
        });
    });

    it('should call taskgraph service to find active graph', function () {
        taskGraphService.workflowsGet.resolves([workflow]);
        return workflowApiService.findActiveGraphForTarget('testnodeid')
            .then(function() {
                expect(taskGraphService.workflowsGet).to.have.been.calledOnce;
            });
    });

    it('should persist a graph definition', function () {
        taskGraphService.workflowsPutGraphs.resolves();
        return workflowApiService.defineTaskGraph(graphDefinition)
        .then(function() {
            expect(taskGraphService.workflowsPutGraphs).to.have.been.calledOnce;
            expect(taskGraphService.workflowsPutGraphs).to.have.been.calledWith(graphDefinition);
        });
    });

    it('should throw a NotFoundError if a graph definition does not exist', function() {
        taskGraphService.workflowsGetByInstanceId.resolves({});
        return expect(workflowApiService.findGraphDefinitionByName('test'))
                .to.be.rejectedWith(Errors.NotFoundError, /not found/);
    });

    it('should get workflows tasks by name', function () {
        taskGraphService.workflowsGetTasksByName.resolves({ injectableName: 'test' });
        return workflowApiService.getWorkflowsTasksByName(taskDefinition)
        .then(function() {
            expect(taskGraphService.workflowsGetTasksByName).to.have.been.calledOnce;
            expect(taskGraphService.workflowsGetTasksByName).to.have.been.calledWith(taskDefinition);  //jshint ignore:line
        });
    });


    it('should delete/destroy graph', function () {
        taskGraphService.workflowsDeleteGraphsByName.resolves(graph);
        return workflowApiService.destroyGraphDefinition(taskDefinition)
        .then(function() {
            expect(taskGraphService.workflowsDeleteGraphsByName).to.have.been.calledOnce;
            expect(taskGraphService.workflowsDeleteGraphsByName).to.have.been.calledWith(taskDefinition); //jshint ignore:line
        });
    });


    it('should put workflows tasks by name', function () {
        taskGraphService.workflowsPutTask.resolves(task);
        return workflowApiService.defineTask(taskDefinition)
        .then(function() {
            expect(taskGraphService.workflowsPutTask).to.have.been.calledOnce;
            expect(taskGraphService.workflowsPutTask).to.have.been.calledWith(taskDefinition);
        });
    });

    it('should cancel a workflow ', function () {
        taskGraphService.workflowsAction.resolves();
        return workflowApiService.cancelTaskGraph('test')
            .then(function() {
                expect(taskGraphService.workflowsAction).to.have.been.calledOnce;
            });
    });


    it('should delete workflows tasks by name', function () {
        taskGraphService.workflowsDeleteTasksByName.resolves(task);
        return workflowApiService.deleteWorkflowsTasksByName(task)
        .then(function() {
            expect(taskGraphService.workflowsDeleteTasksByName).to.have.been.calledOnce;
            expect(taskGraphService.workflowsDeleteTasksByName).to.have.been.calledWith(task);
        });
    });

    it('should return workflow by instanceId ', function() {
        taskGraphService.workflowsGet.resolves([workflow]);
        return workflowApiService.getWorkflowByInstanceId()
            .then(function (workflows) {
            expect(workflows).to.deep.equal(workflow);
        });
    });

    it('should return Not Found Error when invalid instanceId is passed', function() {
        taskGraphService.workflowsGet.resolves({});
        return expect(workflowApiService.getWorkflowByInstanceId())
            .to.be.rejectedWith(Errors.NotFoundError, /not found/);
    });

    it('should return active workflows ', function() {
        var activeWorkflow = {
                               id      : 'testgraphid',
                               _status : 'pending'
                             };
        taskGraphService.workflowsGet.resolves([activeWorkflow]);
        return expect(workflowApiService.getWorkflowByInstanceId()).to.become(activeWorkflow);
    });
});
