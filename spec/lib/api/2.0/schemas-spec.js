// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Schemas', function () {
    var schemaService;
    var workflowApiService;
    var Task;

    helper.httpServerBefore();

    before(function () {
        schemaService = helper.injector.get('Http.Api.Services.Schema');
        workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
        Task = helper.injector.get('Task.Task');
    });

    helper.httpServerAfter();

    describe("GET /schemas", function() {

        it("should a list of all schemas", function() {
            this.sandbox.stub(schemaService, "getNamespace").returns([
                "schema1",
                "schema2"
            ]);

            return helper.request().get('/api/2.0/schemas')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.be.an("Array").with.length(2);
                    expect(res.body[0]).to.equal("schema1");
                    expect(schemaService.getNamespace).to.be.called.once;
                });
        });

        it("should return an empty array if no schemas exist", function() {
            this.sandbox.stub(schemaService, "getNamespace").returns([]);

            return helper.request().get('/api/2.0/schemas')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.be.an("Array").with.length(0);
                });
        });
    });

    describe("GET /schemas/:identifier", function() {

        it("should return an individual schema", function() {
            this.sandbox.stub(schemaService, "getSchema").returns({
                    title: 'schema',
                    description: 'a schema',
                    type: 'object',
                    name: { something: 'here' }
                });

            return helper.request().get('/api/2.0/schemas/123')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.have.property("title", "schema");
                    expect(res.body).to.be.an("Object").with.property('description', "a schema");
                    expect(schemaService.getSchema).to.be.called.once;
                });
        });

        it("should return a 404 if no schema can be found", function() {
            this.sandbox.stub(schemaService, "getSchema").returns(undefined);

            return helper.request().get('/api/2.0/schemas/junk')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });

    describe("GET /schemas/tasks", function() {

        it("should return a list of all task schemas' name", function() {
            this.sandbox.stub(workflowApiService, 'getTaskDefinitions').resolves([
                {
                    injectableName: 'Task.foo',
                    friendlyName: 'foo',
                    options: {
                        a: 1
                    }
                },
                {
                    injectableName: 'Task.bar',
                    friendlyName: 'bar',
                    options: {
                        b: 2
                    }
                }
            ]);
            return helper.request().get('/api/2.0/schemas/tasks')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.be.an("Array").with.length(2);
                    expect(res.body[0]).to.equal("Task.foo");
                    expect(res.body[1]).to.equal("Task.bar");
                });
        });

        it("should return an empty array if no schemas exist", function() {
            this.sandbox.stub(workflowApiService, 'getTaskDefinitions').resolves([]);
            return helper.request().get('/api/2.0/schemas/tasks')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.be.an("Array").with.length(0);
                });
        });
    });

    describe("GET /schemas/tasks/:identifier", function() {
        var task = {
            injectableName: 'Task.foo',
            friendlyName: 'foo',
            options: {
                a: 1
            }
        };

        var testSchema = {
            title: 'schema',
            description: 'a test schema',
            properties: {
                name: { type: 'string' },
                uid: { type: 'number' }
            }
        };

        it("should return a task schema", function() {
            this.sandbox.stub(workflowApiService, 'getWorkflowsTasksByName')
                .withArgs('Task.foo').resolves([task]);
            this.sandbox.stub(Task, 'getFullSchema')
                .withArgs(task).returns(testSchema);

            return helper.request().get('/api/2.0/schemas/tasks/Task.foo')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.deep.equals(testSchema);
                });
        });

        it("should return a 404 if no schema can be found", function() {
            this.sandbox.stub(workflowApiService, 'getWorkflowsTasksByName')
                .withArgs('junk').resolves([]);
            return helper.request().get('/api/2.0/schemas/tasks/junk')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });
});
