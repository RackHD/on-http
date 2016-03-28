// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Workflows.2.0', function () {
    var workflowApiService;

    before('start HTTP server', function () {
        this.timeout(5000);
        workflowApiService = {
            getGraphDefinitions: sinon.stub(),
            workflowsGetGraphsByName: sinon.stub(),
            defineTaskGraph: sinon.stub(),
            destroyGraphDefinition: sinon.stub()
        };

        return helper.startServer([
            dihelper.simpleWrapper(workflowApiService, 'Http.Services.Api.Workflows'),
        ]);
    });

    after('stop HTTP server', function () {
        return helper.stopServer();
    });

    afterEach('set up mocks', function () {
        workflowApiService.getGraphDefinitions.reset();
        workflowApiService.workflowsGetGraphsByName.reset();
        workflowApiService.defineTaskGraph.reset();
        workflowApiService.destroyGraphDefinition.reset();
    });

    describe('workflowsGetGraphs', function () {
        it('should retrieve the workflow Graphs', function () {
            var task = { name: 'foobar' };
            workflowApiService.getGraphDefinitions.resolves([task]);

            return helper.request().get('/api/2.0/workflows/graphs')
                .expect('Content-Type', /^application\/json/)
                .expect(200, [task]);
        });
    });

    describe('workflowsGetGraphsByName', function () {
        it('should retrieve the graph by Name', function () {
            var graph = { name: 'foobar' };
            workflowApiService.getGraphDefinitions.resolves(graph);

            return helper.request().get('/api/2.0/workflows/graphs/' + graph.name)
                .expect('Content-Type', /^application\/json/)
                .expect(200, graph)
                .expect(function() {
                    expect(workflowApiService.getGraphDefinitions).to.have.been.calledOnce;
                    expect(workflowApiService.getGraphDefinitions)
                        .to.have.been.calledWith('foobar');
                });
        });
    });

   describe('workflowsPutGraphs', function () {
        it('should persist a graph', function () {
            var graph = { name: 'foobar' };
            workflowApiService.defineTaskGraph.resolves(graph);

            return helper.request().put('/api/2.0/workflows/graphs')
            .send(graph)
            .expect('Content-Type', /^application\/json/)
            .expect(201, graph);
        });
    });

   describe('workflowsDeleteGraphsByName', function () {
        it('should delete Graph by name', function () {
            var graph = { name: 'Destroy.Me' };
            workflowApiService.destroyGraphDefinition.resolves(graph);

            return helper.request().delete('/api/2.0/workflows/graphs/' + graph.name)
            .expect('Content-Type', /^application\/json/)
            .expect(200, graph)
            .expect(function() {
                expect(workflowApiService.destroyGraphDefinition).to.have.been.calledOnce;
                expect(workflowApiService.destroyGraphDefinition)
                    .to.have.been.calledWith('Destroy.Me');
            });
        });
    });
});

