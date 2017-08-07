// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.workflowTasks.2.0', function () {
    var waterline;
    var arpCache = {};
    var workflowApiService;
    var views;

    helper.httpServerBefore([
        dihelper.simpleWrapper(arpCache, 'ARPCache')
    ]);

    before(function () {
        workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
        waterline = helper.injector.get('Services.Waterline');
        views = helper.injector.get('Views');
    });

    beforeEach('set up mocks', function () {
        arpCache = {
            getCurrent: this.sandbox.stub().resolves([])
        };
        waterline.nodes = {
            findByIdentifier: this.sandbox.stub().resolves()
        };
        waterline.graphobjects = {
            find: this.sandbox.stub().resolves([]),
            findByIdentifier: this.sandbox.stub().resolves(),
            needByIdentifier: this.sandbox.stub().resolves()
        };
        waterline.lookups = {
            // This method is for lookups only and it
            // doesn't impact behavior whether it is a
            // resolve or a reject since it's related
            // to logging.
            findOneByTerm: this.sandbox.stub().rejects()
        };

        this.sandbox.stub(workflowApiService, 'defineTask').resolves();
        this.sandbox.stub(workflowApiService, 'getTaskDefinitions').resolves();
        this.sandbox.stub(workflowApiService, 'getWorkflowsTasksByName').resolves();
        this.sandbox.stub(workflowApiService, 'deleteWorkflowsTasksByName').resolves();
        this.sandbox.stub(views, 'get').resolves({});
        this.sandbox.stub(views, 'render').resolves('{"friendlyName": "dummy", "injectableName": "dummyName", "options": {"oids": "SNMPv2-MIB::sysDescr"}}');
        this.sandbox.stub(helper.injector.get('ejs'), 'render').resolves('{"friendlyName": "dummy", "injectableName": "dummyName", "options": {"oids": "SNMPv2-MIB::sysDescr"}}');
    });

    helper.httpServerAfter();

    describe('workflowsPutTask ', function () {
        it('should persist a task', function () {
            var task = {
                friendlyName: 'dummy',
                injectableName: 'dummyName',
                options: {
                    oids: 'SNMPv2-MIB::sysDescr'
                }
            };
            workflowApiService.defineTask.resolves(task);

            return helper.request().put('/api/2.0/workflows/tasks')
                .send(task)
                .expect('Content-Type', /^application\/json/)
                .expect(201, task);
        });

    });

    describe('workflowsGetAllTasks', function () {
        it('should return a list of persisted graph objects', function () {
            var workflowTask = {
                friendlyName: 'dummy',
                injectableName: 'dummyName',
                options: {
                    oids: 'SNMPv2-MIB::sysDescr'
                }
            };
            workflowApiService.getTaskDefinitions.resolves([workflowTask]);
            return helper.request().get('/api/2.0/workflows/tasks')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(workflowApiService.getTaskDefinitions).to.have.been.calledOnce;
                    expect(res.body).to.have.property('friendlyName', 'dummy');
                    expect(res.body).to.have.property('injectableName', 'dummyName');
                    expect(res.body).to.have.property('options').to.be.an('object');
                    expect(res.body).to.have.deep.property('options.oids', 'SNMPv2-MIB::sysDescr');
                });
        });

        it('should return an empty list of persisted graph objects', function () {
            var graph = [];
            workflowApiService.getTaskDefinitions.resolves(graph);

            return helper.request().get('/api/2.0/workflows/tasks')
                .expect('Content-Type', /^application\/json/)
                .expect(200, graph)
                .expect(function () {
                    expect(workflowApiService.getTaskDefinitions).to.have.been.calledOnce;
                });
        });

    });

    describe('workflowsGetTasksByName', function () {
        var workflowTask = {
            friendlyName: 'dummy',
            injectableName: 'dummyName',
            options: {
                oids: 'SNMPv2-MIB::sysDescr'
            }
        };

        it('should return a particular task persisted graph objects', function () {
            workflowApiService.getWorkflowsTasksByName.resolves(workflowTask);
            return helper.request().get('/api/2.0/workflows/tasks/'+workflowTask.injectableName)
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function ( res ) {
                expect(workflowApiService.getWorkflowsTasksByName).to.have.been.calledOnce;
                expect(workflowApiService.getWorkflowsTasksByName)
                    .to.have.been.calledWith(workflowTask.injectableName);
                expect(res.body).to.have.property('friendlyName', 'dummy');
                expect(res.body).to.have.property('injectableName', 'dummyName');
                expect(res.body).to.have.property('options').to.be.an('object');
                expect(res.body).to.have.deep.property('options.oids', 'SNMPv2-MIB::sysDescr');
            });
        });

        it('should return 404 when getWorkflowsTasksByName is not found', function () {
            var badGraphName = 'invalidName';
            var Errors = helper.injector.get('Errors');
            workflowApiService.getWorkflowsTasksByName.rejects(new Errors.NotFoundError('test'));
            views.render.resolves('{"message": "error"}');
            return helper.request().get('/api/2.0/workflows/tasks/'+badGraphName)
            .expect('Content-Type', /^application\/json/)
            .expect(404);
        });

    });

    describe('workflowsDeleteTasksByName', function () {
        var workflowTask;
        beforeEach(function () {
            var task = {
                friendlyName: 'dummy',
                injectableName: 'dummyName',
                options: {
                    oids: 'SNMPv2-MIB::sysDescr'
                }
            };
            workflowApiService.defineTask.resolves(task);
            return helper.request().put('/api/2.0/workflows/tasks')
            .send({
                friendlyName: 'dummy',
                injectableName: 'dummyName',
                options: {
                    oids: 'SNMPv2-MIB::sysDescr'
                }
            })
            .expect('Content-Type', /^application\/json/)
            .expect(201)
            .then(function (req) {
                workflowTask = req.body;
            });
        });

        it('should delete the Task with DELETE /workflows/tasks/injectableName', function () {
            return helper.request().delete('/api/2.0/workflows/tasks/'+ workflowTask.injectableName)
                .expect(204);
        });
    });

});
