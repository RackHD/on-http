// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Tasks', function () {
    var taskProtocol;
    var tasksApiService;
    var waterline;
    var lookupService;

    before('start HTTP server', function () {
        this.timeout(5000);
        return helper.startServer();
    });

    beforeEach('set up mocks', function () {
        taskProtocol = helper.injector.get('Protocol.Task');
        // Defaults, you can tack on .resolves().rejects().resolves(), etc. like so
        taskProtocol.activeTaskExists = sinon.stub().resolves();
        taskProtocol.requestCommands = sinon.stub().resolves({ testcommands: 'cmd' });
        taskProtocol.respondCommands = sinon.stub();

        // mock waterline templates to return a template for bootstrap
        waterline = helper.injector.get('Services.Waterline');
        waterline.templates.find = sinon.stub();

        tasksApiService = helper.injector.get('Http.Services.Api.Tasks');
        tasksApiService.getNode = sinon.stub();

        lookupService = helper.injector.get('Services.Lookup');
        lookupService.ipAddressToMacAddress = sinon.stub().resolves('00:11:22:33:44:55');
        return helper.reset();
    });

    after('stop HTTP server', function () {
        return helper.stopServer();
    });

    describe('GET /tasks/:id', function () {
        it("should send down tasks", function() {
            taskProtocol.activeTaskExists.resolves(null);
            return helper.request().get('/api/1.1/tasks/testnodeid')
            .expect(200)
            .expect(function (res) {
                expect(res.body).to.deep.equal({ testcommands: 'cmd' });
            });
        });

        it("should return 204 if no active task exists", function() {
            var tasksApiService = helper.injector.get('Http.Services.Api.Tasks');
            taskProtocol.activeTaskExists.rejects(new tasksApiService.NoActiveTaskError());
            return helper.request().get('/api/1.1/tasks/testnodeid')
            .expect(204)
            .expect(function (res) {
                expect(res.body).to.be.empty;
            });
        });

        it("should error if an active task exists but no commands are sent", function() {
            taskProtocol.requestCommands.rejects(new Error(''));
            return helper.request().get('/api/1.1/tasks/testnodeid')
            .expect(404)
            .expect(function (res) {
                expect(res.body).to.be.empty;
            });
        });


    });

    describe("GET /tasks/bootstrap.js", function() {
        it("should render a bootstrap for the node", function() {
            tasksApiService.getNode.resolves({ id: '123' });
            waterline.templates.find.resolves([{
                name: 'bootstrap.js',
                contents: 'test contents'
            }]);

            return helper.request().get('/api/1.1/tasks/bootstrap.js?macAddress=00:11:22:33:44:55')
                .expect(200)
                .expect(function (res) {
                    expect(tasksApiService.getNode).to.have.been.calledWith('00:11:22:33:44:55');
                    expect(res.text).to.equal('test contents');
                });
        });

        it("should render a 404 if node not found", function() {
            tasksApiService.getNode.resolves(null);
            waterline.templates.find.resolves([{
                name: 'bootstrap.js',
                contents: 'test contents'
            }]);

            return helper.request()
                .get('/api/1.1/tasks/bootstrap.js?macAddress=00:11:22:33:44:55')
                .expect(404);
        });

        it("should render a 500 if tasksApiService.getNode errors", function() {
            tasksApiService.getNode.rejects(new Error('asdf'));
            return helper.request()
                .get('/api/1.1/tasks/bootstrap.js?macAddress=00:11:22:33:44:55')
                .expect(500);
        });
    });

    describe("POST /tasks/:id", function () {
        it("should accept a large entity response", function() {
            function createBigString() {
                var x = "";
                for (var i = 0; i < 200000; i+=1) {
                    x += "1";
                }
                return x;
            }

            var data = { foo: createBigString() };

            return helper.request().post('/api/1.1/tasks/123')
            .send(data)
            .expect(function () {
                expect(taskProtocol.respondCommands).to.have.been.calledWith('123', data);
            })
            .expect(201);
        });
    });
});
