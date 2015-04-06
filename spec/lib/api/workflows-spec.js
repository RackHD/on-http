// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Workflows', function () {
    var waterline;
    var taskGraphRunner;
    before('start HTTP server', function () {
        this.timeout(5000);
        taskGraphRunner = {};
        waterline = {
            start: sinon.stub(),
            stop: sinon.stub()
        };
        var resources = {
            register: sinon.stub(),
            unregister: sinon.stub()
        };
        return helper.startServer([
            dihelper.simpleWrapper(taskGraphRunner, 'Protocol.TaskGraphRunner'),
            dihelper.simpleWrapper(waterline, 'Services.Waterline'),
            dihelper.simpleWrapper(resources, 'common-stomp-resources'),
            require('on-core/spec/mocks/logger')
        ]);
    });

    after('stop HTTP server', function () {
        return helper.stopServer();
    });

    beforeEach('set up mocks', function () {
        taskGraphRunner.defineTask = sinon.stub().resolves();
        taskGraphRunner.defineTaskGraph = sinon.stub().resolves();
        taskGraphRunner.getTaskGraphLibrary = sinon.stub().resolves();
        taskGraphRunner.getTaskLibrary = sinon.stub().resolves();
        waterline.nodes = {
            findByIdentifier: sinon.stub().resolves()
        };
        waterline.graphobjects = {
            find: sinon.stub().resolves([]),
            findByIdentifier: sinon.stub().resolves()
        };
    });

    describe('GET /workflows', function () {
        it('should return a list of persisted graph objects', function () {
            var graph = { name: 'foobar' };
            waterline.graphobjects.find.resolves([graph]);

            return helper.request().get('/api/1.1/workflows')
            .expect('Content-Type', /^application\/json/)
            .expect(200, [graph]);
        });
    });

    describe('GET /workflows/:id', function () {
        it('should return a single persisted graph', function () {
            var graph = { name: 'foobar' };
            waterline.graphobjects.findByIdentifier.resolves(graph);

            return helper.request().get('/api/1.1/workflows/12345')
            .expect('Content-Type', /^application\/json/)
            .expect(200, graph)
            .expect(function () {
                expect(waterline.graphobjects.findByIdentifier).to.have.been.calledOnce;
                expect(waterline.graphobjects.findByIdentifier)
                .to.have.been.calledWith('12345');
            });
        });
    });

    describe('PUT /workflows', function () {
        it('should persist a task graph', function () {
            var graph = { name: 'foobar' };
            taskGraphRunner.defineTaskGraph.resolves(graph);

            return helper.request().put('/api/1.1/workflows')
            .send(graph)
            .expect('Content-Type', /^application\/json/)
            .expect(200, graph);
        });
    });

    describe('PUT /workflows/tasks', function () {
        it('should persist a task', function () {
            var task = { name: 'foobar' };
            taskGraphRunner.defineTask.resolves(task);

            return helper.request().put('/api/1.1/workflows/tasks')
            .send(task)
            .expect('Content-Type', /^application\/json/)
            .expect(200, task);
        });
    });

    describe('GET /workflows/tasks/library', function () {
        it('should retrieve the task library', function () {
            var task = { name: 'foobar' };
            taskGraphRunner.getTaskLibrary.resolves([task]);

            return helper.request().get('/api/1.1/workflows/tasks/library')
            .expect('Content-Type', /^application\/json/)
            .expect(200, [task]);
        });
    });

    describe('GET /workflows/library', function () {
        it('should retrieve the graph library', function () {
            var graph = { name: 'foobar' };
            taskGraphRunner.getTaskGraphLibrary.resolves([graph]);

            return helper.request().get('/api/1.1/workflows/library')
            .expect('Content-Type', /^application\/json/)
            .expect(200, [graph]);
        });
    });

    describe('GET /workflows/library/:id', function () {
        it('should retrieve a graph from the graph library', function () {
            var graph = { friendlyName: 'foobar' };
            taskGraphRunner.getTaskGraphLibrary.resolves([graph]);

            return helper.request().get('/api/1.1/workflows/library/1234')
            .expect('Content-Type', /^application\/json/)
            .expect(200, [graph])
            .expect(function () {
                expect(taskGraphRunner.getTaskGraphLibrary).to.have.been.calledOnce;
                expect(taskGraphRunner.getTaskGraphLibrary.firstCall.args[0])
                .to.have.property('injectableName').that.equals('1234');
            });
        });
    });
});
