// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Schemas', function () {
    var schemaService;
    var stubGetNamespace;
    var stubGetSchema;
    var taskOptionValidator;

    before('start HTTP server', function () {
        this.timeout(10000);
        return helper.startServer([]).then(function () {
            schemaService = helper.injector.get('Http.Api.Services.Schema');
            stubGetNamespace = sinon.stub(schemaService, "getNamespace");
            stubGetSchema = sinon.stub(schemaService, "getSchema");
            taskOptionValidator = helper.injector.get('TaskOption.Validator');
        });
    });

    afterEach("reset stubs", function() {
        stubGetNamespace.reset();
        stubGetSchema.reset();
    });

    after('stop HTTP server', function () {
        schemaService.getSchema.restore();
        schemaService.getNamespace.restore();
        return helper.stopServer();
    });

    describe("GET /schemas", function() {

        it("should a list of all catalogs", function() {

            stubGetNamespace.returns([
                "schema1",
                "schema2"
            ]);

            return helper.request().get('/api/2.0/schemas')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.be.an("Array").with.length(2);
                    expect(res.body[0]).to.equal("schema1");
                    expect(stubGetNamespace).to.be.called.once;
                });
        });

        it("should return an empty array if no schemas exist", function() {

            stubGetNamespace.returns([]);

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

            stubGetSchema.returns({
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
                    expect(stubGetSchema).to.be.called.once;
                });
        });

        it("should return a 404 if no schema can be found", function() {

            stubGetSchema.returns(undefined);

            return helper.request().get('/api/2.0/schemas/junk')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });

    describe("GET /schemas/tasks", function() {
        before(function () {
            sinon.stub(taskOptionValidator, 'getAllSchemaNames');
        });

        beforeEach(function () {
            taskOptionValidator.getAllSchemaNames.reset();
        });

        after(function () {
            taskOptionValidator.getAllSchemaNames.restore();
        });

        it("should return a list of all task schemas", function() {

            taskOptionValidator.getAllSchemaNames.returns([
                "tasks/schema1",
                "tasks/schema2"
            ]);

            return helper.request().get('/api/2.0/schemas/tasks')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.be.an("Array").with.length(2);
                    expect(res.body[0]).to.equal("tasks/schema1");
                    expect(res.body[1]).to.equal("tasks/schema2");
                    expect(taskOptionValidator.getAllSchemaNames).to.be.called.once;
                });
        });

        it("should return an empty array if no schemas exist", function() {

            taskOptionValidator.getAllSchemaNames.returns([]);

            return helper.request().get('/api/2.0/schemas/tasks')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.be.an("Array").with.length(0);
                });
        });
    });

    describe("GET /schemas/tasks/:identifier", function() {
        var testSchema = {
            title: 'schema',
            description: 'a test schema',
            properties: {
                name: { type: 'string' },
                uid: { type: 'number' }
            }
        };

        before(function () {
            sinon.stub(taskOptionValidator, 'getSchema');
            sinon.stub(taskOptionValidator, 'getSchemaResolved');
        });

        beforeEach(function () {
            taskOptionValidator.getSchema.reset();
            taskOptionValidator.getSchemaResolved.reset();
        });

        after(function () {
            taskOptionValidator.getSchema.restore();
            taskOptionValidator.getSchemaResolved.restore();
        });

        it("should return a task schema", function() {
            taskOptionValidator.getSchema.returns(testSchema);

            return helper.request().get('/api/2.0/schemas/tasks/testSchema')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(taskOptionValidator.getSchema).to.be.called.once;
                    expect(taskOptionValidator.getSchemaResolved).to.not.be.called;
                    expect(res.body).to.deep.equals(testSchema);
                });
        });

        it("should return a task schema with reference resolved", function() {
            taskOptionValidator.getSchemaResolved.returns(testSchema);

            return helper.request()
                .get('/api/2.0/schemas/tasks/testSchema?resolveRef=true')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(taskOptionValidator.getSchemaResolved).to.be.called.once;
                    expect(taskOptionValidator.getSchema).to.not.be.called;
                    expect(res.body).to.deep.equals(testSchema);
                });
        });

        it("should return a 404 if no schema can be found", function() {
            taskOptionValidator.getSchema.returns();

            return helper.request().get('/api/2.0/schemas/tasks/junk')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });
});
