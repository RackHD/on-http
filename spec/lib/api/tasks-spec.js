// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

describe('Tasks API', function () {
    var taskProtocol;
    before(function () {
        this.timeout(5000);
        taskProtocol = {};
        return helper.startServer([
            dihelper.simpleWrapper(taskProtocol, 'Protocol.Task')
        ]);
    });

    beforeEach(function () {
        var taskProtocol = helper.injector.get('Protocol.Task');
        // Defaults, you can tack on .resolves().rejects().resolves(), etc. like so
        taskProtocol.activeTaskExists = sinon.stub().resolves();
        taskProtocol.requestCommands = sinon.stub().resolves({ testcommands: 'cmd' });
        return helper.reset();
    });

    after(function () {
        return helper.stopServer();
    });

    it("should send down tasks", function() {
        taskProtocol.activeTaskExists.resolves(null);
        return helper.request().get('/api/1.1/tasks/testnodeid')
            .expect(200)
            .expect(function (res) {
                expect(res.body).to.deep.equal({ testcommands: 'cmd' });
            });
    });

    it("should noop if no active task exists", function() {
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
