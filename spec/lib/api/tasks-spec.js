// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

describe('Tasks API', function () {
    var taskProtocol;
    var tasksApiService;
    var waterline;

    before(function () {
        this.timeout(5000);
        taskProtocol = {};
        return helper.startServer([
            dihelper.simpleWrapper(taskProtocol, 'Protocol.Task')
        ]);
    });

    beforeEach(function () {
        taskProtocol = helper.injector.get('Protocol.Task');
        // Defaults, you can tack on .resolves().rejects().resolves(), etc. like so
        taskProtocol.activeTaskExists = sinon.stub().resolves();
        taskProtocol.requestCommands = sinon.stub().resolves({ testcommands: 'cmd' });
        taskProtocol.respondCommands = sinon.stub();

        // mock waterline templates to return a template for bootstrap
        waterline = helper.injector.get('Services.Waterline');
        waterline.templates.findOne = sinon.stub();

        tasksApiService = helper.injector.get('Http.Services.Api.Tasks');
        tasksApiService.getNode = sinon.stub();
        return helper.reset();
    });

    after(function () {
        return helper.stopServer();
    });

    it("should send down tasks", function() {
        taskProtocol.activeTaskExists.resolves(null);
        return helper.request().get('/api/common/tasks/testnodeid')
            .expect(200)
            .expect(function (res) {
                expect(res.body).to.deep.equal({ testcommands: 'cmd' });
            });
    });

    it("should noop if no active task exists", function() {
        var tasksApiService = helper.injector.get('Http.Services.Api.Tasks');
        taskProtocol.activeTaskExists.rejects(new tasksApiService.NoActiveTaskError());
        return helper.request().get('/api/common/tasks/testnodeid')
            .expect(204)
            .expect(function (res) {
                expect(res.body).to.be.empty;
            });
    });

    it("should error if an active task exists but no commands are sent", function() {
        taskProtocol.requestCommands.rejects(new Error(''));
        return helper.request().get('/api/common/tasks/testnodeid')
            .expect(404)
            .expect(function (res) {
                expect(res.body).to.be.empty;
            });
    });

    describe("/api/common/tasks/bootstrap.js", function() {
        it("should render a bootstrap for the node", function() {
            tasksApiService.getNode.resolves({ id: '123' });
            waterline.templates.findOne.resolves({
                name: 'bootstrap.js',
                contents: 'test contents'
            });

            return helper.request().get('/api/common/tasks/bootstrap.js?macAddress=00:11:22:33:44:55')
                .expect(200)
                .expect('Content-Type', /^text\/html/)
                .expect(function (res) {
                    expect(tasksApiService.getNode).to.have.been.calledWith('00:11:22:33:44:55');
                    expect(res.text).to.equal('test contents');
                });
        });

        it("should render a 404 if node not found", function() {
            tasksApiService.getNode.resolves(null);
            waterline.templates.findOne.resolves({
                name: 'bootstrap.js',
                contents: 'test contents'
            });

            return helper.request()
                .get('/api/common/tasks/bootstrap.js?macAddress=00:11:22:33:44:55')
                .expect(404);
        });

    });

    it("verify tasks accept a large entity response", function() {

        function createBigString() {
            var x = "";
            for (var i = 0; i < 200000; i+=1) {
                x += "1";
            }
            return x;
        }

        var data = { foo: createBigString() };

        return helper.request().post('/api/common/tasks/123')
            .send(data)
            .expect(function () {
                expect(taskProtocol.respondCommands).to.have.been.calledWith('123', data);
            })
            .expect(201);
    });
});
