// Copyright 2016, EMC, Inc.

'use strict';

describe('Http.Services.Api.Workflows', function () {
    var Errors;
    var workflowApiService;
    var graph;
    var graphDefinition;
    var store;
    var waterline;
    var env;

    before('Http.Services.Api.Workflows before', function() {
        helper.setupInjector([
            onHttpContext.prerequisiteInjectables,
            helper.require('/lib/services/workflow-api-service')
        ]);
        Errors = helper.injector.get('Errors');
        workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
        waterline = helper.injector.get('Services.Waterline');
        store = helper.injector.get('TaskGraph.Store');
        env = helper.injector.get('Services.Environment');
    });

    beforeEach(function() {
        waterline.nodes = {
            needByIdentifier: sinon.stub().resolves({ id: 'testnodeid' })
        };
        graph = { instanceId: 'testgraphid' };
        graphDefinition = { injectableName: 'Graph.Test' };
        this.sandbox = sinon.sandbox.create();
        this.sandbox.stub(store, 'findActiveGraphForTarget');
        this.sandbox.stub(store, 'getGraphDefinitions');
        this.sandbox.stub(store, 'persistGraphDefinition');
        this.sandbox.stub(workflowApiService, 'findGraphDefinitionByName');
        this.sandbox.stub(workflowApiService, 'createActiveGraph');
        this.sandbox.stub(workflowApiService, 'runTaskGraph');
        this.sandbox.stub(env, 'get');
    });

    afterEach('Http.Services.Api.Profiles afterEach', function() {
        this.sandbox.restore();
    });

    after(function() {
        sinon.stub(workflowApiService, 'createAndRunGraph');
    });

    it('should create and run a graph not against a node', function () {
        workflowApiService.findGraphDefinitionByName.resolves(graphDefinition);
        workflowApiService.createActiveGraph.resolves(graph);
        workflowApiService.runTaskGraph.resolves();

        return workflowApiService.createAndRunGraph({
            name: 'Graph.Test',
            options: { test: 1 },
            context: { test: 2 },
            domain: 'test'
        })
        .then(function() {
            expect(workflowApiService.findGraphDefinitionByName).to.have.been.calledOnce;
            expect(workflowApiService.findGraphDefinitionByName)
                .to.have.been.calledWith('Graph.Test');
            expect(store.findActiveGraphForTarget).to.not.have.been.called;
            expect(workflowApiService.createActiveGraph).to.have.been.calledOnce;
            expect(workflowApiService.createActiveGraph).to.have.been.calledWith(
                graphDefinition, { test: 1 }, { test: 2 }, 'test'
            );
            expect(workflowApiService.runTaskGraph).to.have.been.calledOnce;
            expect(workflowApiService.runTaskGraph)
                .to.have.been.calledWith(graph.instanceId, 'test');
        });
    });

    it('should create and run a graph against a node', function () {
        workflowApiService.findGraphDefinitionByName.resolves(graphDefinition);
        workflowApiService.createActiveGraph.resolves(graph);
        workflowApiService.runTaskGraph.resolves();
        store.findActiveGraphForTarget.resolves();

        return workflowApiService.createAndRunGraph({
            name: 'Graph.Test',
            options: { test: 1 },
            context: { test: 2 },
            domain: 'test'
        }, 'testnodeid')
        .then(function() {
            expect(workflowApiService.findGraphDefinitionByName).to.have.been.calledOnce;
            expect(workflowApiService.findGraphDefinitionByName)
                .to.have.been.calledWith('Graph.Test');
            expect(store.findActiveGraphForTarget).to.have.been.calledOnce;
            expect(store.findActiveGraphForTarget).to.have.been.calledWith('testnodeid');
            expect(workflowApiService.createActiveGraph).to.have.been.calledOnce;
            expect(workflowApiService.createActiveGraph).to.have.been.calledWith(
                graphDefinition, { test: 1 }, { target: 'testnodeid', test: 2 }, 'test'
            );
            expect(workflowApiService.runTaskGraph).to.have.been.calledOnce;
            expect(workflowApiService.runTaskGraph)
                .to.have.been.calledWith(graph.instanceId, 'test');
            expect(env.get).to.not.be.called;
        });
    });

    it('should create and run a graph against a node with a sku', function () {
        workflowApiService.findGraphDefinitionByName.resolves(graphDefinition);
        workflowApiService.createActiveGraph.resolves(graph);
        workflowApiService.runTaskGraph.resolves();
        store.findActiveGraphForTarget.resolves();
        waterline.nodes.needByIdentifier.resolves({ id: 'testnodeid', sku: 'skuid' });
        env.get.withArgs('Graph.Test').resolves('Graph.Test');

        return workflowApiService.createAndRunGraph({
            name: 'Graph.Test',
            options: { test: 1 },
            context: { test: 2 },
            domain: 'test'
        }, 'testnodeid')
        .then(function() {
            expect(workflowApiService.findGraphDefinitionByName).to.have.been.calledOnce;
            expect(workflowApiService.findGraphDefinitionByName)
                .to.have.been.calledWith('Graph.Test');
            expect(store.findActiveGraphForTarget).to.have.been.calledOnce;
            expect(store.findActiveGraphForTarget).to.have.been.calledWith('testnodeid');
            expect(workflowApiService.createActiveGraph).to.have.been.calledOnce;
            expect(workflowApiService.createActiveGraph).to.have.been.calledWith(
                graphDefinition, { test: 1 }, { target: 'testnodeid', test: 2 }, 'test'
            );
            expect(workflowApiService.runTaskGraph).to.have.been.calledOnce;
            expect(workflowApiService.runTaskGraph)
                .to.have.been.calledWith(graph.instanceId, 'test');
            expect(env.get).to.have.been.calledWith('Graph.Test', 'Graph.Test', ['skuid']);
        });
    });

    it('should create and run a graph against a node with a sku', function () {
        workflowApiService.findGraphDefinitionByName.resolves(graphDefinition);
        workflowApiService.createActiveGraph.resolves(graph);
        workflowApiService.runTaskGraph.resolves();
        store.findActiveGraphForTarget.resolves();
        waterline.nodes.needByIdentifier.resolves({ id: 'testnodeid', sku: 'skuid' });
        env.get.withArgs('Graph.Test').resolves('Graph.Test.skuid');

        return workflowApiService.createAndRunGraph({
            name: 'Graph.Test',
            options: { test: 1 },
            context: { test: 2 },
            domain: 'test'
        }, 'testnodeid')
        .then(function() {
            expect(workflowApiService.findGraphDefinitionByName).to.have.been.calledOnce;
            expect(workflowApiService.findGraphDefinitionByName)
                .to.have.been.calledWith('Graph.Test.skuid');
            expect(store.findActiveGraphForTarget).to.have.been.calledOnce;
            expect(store.findActiveGraphForTarget).to.have.been.calledWith('testnodeid');
            expect(workflowApiService.createActiveGraph).to.have.been.calledOnce;
            expect(workflowApiService.createActiveGraph).to.have.been.calledWith(
                graphDefinition, { test: 1 }, { target: 'testnodeid', test: 2 }, 'test'
            );
            expect(workflowApiService.runTaskGraph).to.have.been.calledOnce;
            expect(workflowApiService.runTaskGraph)
                .to.have.been.calledWith(graph.instanceId, 'test');
            expect(env.get).to.have.been.calledWith('Graph.Test', 'Graph.Test', ['skuid']);
        });
    });

    it('should not create a graph against a node if there is an existing one active', function () {
        workflowApiService.findGraphDefinitionByName.resolves(graphDefinition);
        store.findActiveGraphForTarget.resolves({});

        return expect(
            workflowApiService.createAndRunGraph({
                name: 'Graph.Test',
                options: { test: 1 },
                context: { test: 2 },
                domain: 'test'
            }, 'testnodeid')
        ).to.be.rejectedWith(/Unable to run multiple task graphs against a single target/);
    });

    it('should return a NotFoundError if the node was not found', function () {
        waterline.nodes.needByIdentifier.rejects(new Errors.NotFoundError('Not Found'));
        return expect(workflowApiService.createAndRunGraph({}, 'testnodeid'))
            .to.be.rejectedWith(Errors.NotFoundError);
    });

    it('should return a BadRequestError on a graph creation/validation failure', function () {
        workflowApiService.createActiveGraph.restore();
        workflowApiService.findGraphDefinitionByName.resolves({
            tasks: [
                { label: 'duplicate' },
                { label: 'duplicate' }
            ]
        });

        return expect(workflowApiService.createAndRunGraph({}, 'testnodeid'))
            .to.be.rejectedWith(Errors.BadRequestError,
                /The task label \'duplicate\' is used more than once/);
    });

    it('should return a NotFoundError if the node was not found', function () {
        store.findActiveGraphForTarget.rejects(new Errors.NotFoundError('Not Found'));
        return expect(workflowApiService.findActiveGraphForTarget('testnodeid'))
            .to.be.rejectedWith(Errors.NotFoundError);
    });

    it('should persist a graph definition', function () {
        store.persistGraphDefinition.resolves({ injectableName: 'test' });
        this.sandbox.stub(workflowApiService, 'createGraph').resolves();
        return workflowApiService.defineTaskGraph(graphDefinition)
        .then(function() {
            expect(store.persistGraphDefinition).to.have.been.calledOnce;
            expect(store.persistGraphDefinition).to.have.been.calledWith(graphDefinition);
            expect(workflowApiService.createGraph).to.have.been.calledOnce;
            expect(workflowApiService.createGraph).to.have.been.calledWith(graphDefinition);
        });
    });

    it('should validate a graph definition', function () {
        store.persistGraphDefinition.resolves();
        var badDefinition = {
            tasks: [
                { label: 'duplicate' },
                { label: 'duplicate' }
            ]
        };

        return expect(workflowApiService.defineTaskGraph(badDefinition))
            .to.be.rejectedWith(Errors.BadRequestError,
                /The task label \'duplicate\' is used more than once/);
    });

    it('should throw a NotFoundError if a graph definition does not exist', function() {
        workflowApiService.findGraphDefinitionByName.restore();
        store.getGraphDefinitions.resolves(null);
        return expect(workflowApiService.findGraphDefinitionByName('test'))
            .to.be.rejectedWith(Errors.NotFoundError);
    });

    it('should create and persist a graph', function() {
        var persistStub = sinon.stub().resolves(graph);
        workflowApiService.createActiveGraph.restore();
        this.sandbox.stub(workflowApiService, 'createGraph').resolves({ persist: persistStub });
        return workflowApiService.createActiveGraph(graphDefinition, null, null, null)
        .then(function(_graph) {
            expect(workflowApiService.createGraph).to.have.been.calledOnce;
            expect(workflowApiService.createGraph).to.have.been.calledWith(
                graphDefinition, null, null, null);
            expect(_graph).to.equal(graph);
            expect(persistStub).to.have.been.calledOnce;
        });
    });
});
