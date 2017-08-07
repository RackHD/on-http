// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved.
/* jshint node:true */

'use strict';

describe('Http.Api.Tasks', function () {
    var taskProtocol;
    var tasksApiService;
    var taskGraphApiService;
    var lookupService;
    var templates;

    helper.httpServerBefore();

    before(function() {
        taskProtocol = helper.injector.get('Protocol.Task');
        tasksApiService = helper.injector.get('Http.Services.Api.Tasks');
        taskGraphApiService = helper.injector.get("Http.Services.Api.Taskgraph.Scheduler");
        lookupService = helper.injector.get('Services.Lookup');
        templates = helper.injector.get('Templates');
    });

    beforeEach('set up mocks', function () {
        // Defaults, you can tack on .resolves().rejects().resolves(), etc. like so
        taskProtocol.activeTaskExists = this.sandbox.stub().resolves();
        taskProtocol.requestCommands = this.sandbox.stub().resolves({
                                                            "identifier":"1234", 
                                                            "tasks": [ {"cmd": "testfoo"}
                                                             ]});
        taskProtocol.respondCommands = this.sandbox.stub();
        tasksApiService.getNode = this.sandbox.stub();
        lookupService.ipAddressToMacAddress = this.sandbox.stub().resolves('00:11:22:33:44:55');

        return helper.reset().then(function(){
            return helper.injector.get('Views').load();
        });
    });

    after(function () {
        return helper.reset();
    });

    helper.httpServerAfter();

    describe('GET /tasks/:id', function () {
        it("should send down tasks", function() {
            this.sandbox.stub(taskGraphApiService, 'getTasksById').resolves({
                "identifier":"1234",
                "tasks": [ {"cmd": "testfoo"}
            ]});
            return helper.request().get('/api/2.0/tasks/testnodeid')
            .expect(200)
            .expect(function (res) {
                expect(res.body).to.deep.equal({
                                               "identifier":"1234",
                                               "tasks": [ {"cmd": "testfoo"}
                                               ]});
            });
        });

        it("should error if no task available", function() {
            this.sandbox.stub(taskGraphApiService, 'getTasksById').rejects(new Error(''));
            return helper.request().get('/api/2.0/tasks/testnodeid')
            .expect(404);
        });
    });

    describe("GET /tasks/bootstrap.js", function() {
        var stubTemplates;

        beforeEach(function() {
            stubTemplates = this.sandbox.stub(templates, 'get');
            stubTemplates.withArgs('bootstrap.js').resolves({
                contents: 'test node id: <%= identifier %>'
            });
        });

       it("should render a bootstrap for the node", function() {
            tasksApiService.getNode.resolves({ id: '123' });
            return helper.request().get('/api/2.0/tasks/bootstrap.js?macAddress=00:11:22:33:44:55')
                .expect(200)
                .expect(function (res) {
                    expect(tasksApiService.getNode).to.have.been.calledWith('00:11:22:33:44:55');
                    expect(res.text).to.equal('test node id: 123');
                });
        });

        it("should render a 404 if node not found", function() {
            tasksApiService.getNode.resolves(null);
            return helper.request()
                .get('/api/2.0/tasks/bootstrap.js?macAddress=00:11:22:33:44:55')
                .expect(404);
        });

        it("should render a 400 if tasksApiService.getNode errors", function() {
            tasksApiService.getNode.rejects(new Error('asdf'));
            return helper.request()
                .get('/api/2.0/tasks/bootstrap.js?macAddress=00:11:22:33:44:55')
                .expect(400);
        });
    });

    describe("POST /tasks/:id", function () {
        it("should accept a large entity response", function() {
            var data = { foo: new Array(200000).join('1') };

            this.sandbox.stub(taskGraphApiService, 'postTaskById').resolves({});
            return helper.request().post('/api/2.0/tasks/123')
            .send(data)
            .expect(201)
            .expect(function () {
                expect(taskProtocol.respondCommands).to.have.been.calledWith('123', data);
            })
            .expect(201);
        });
    });
});
