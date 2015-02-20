// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

describe('Profiles API', function () {
    var taskGraphProtocol;
    var taskProtocol;
    var profiles;
    var profileApiService;

    before(function () {
        this.timeout(5000);
        return helper.startServer([]);
    });

    beforeEach(function () {
        taskProtocol = helper.injector.get('Protocol.Task');
        taskGraphProtocol = helper.injector.get('Protocol.TaskGraphRunner');
        profiles = helper.injector.get('Profiles');
        profiles.get = sinon.stub().returns('');
        profileApiService = helper.injector.get('Http.Services.Api.Profiles');
        taskProtocol.activeTaskExists = sinon.stub().resolves({});
        taskProtocol.requestCommands = sinon.stub().resolves({ testcommands: 'cmd' });
        return helper.reset();
    });

    after(function () {
        return helper.stopServer();
    });

    describe("/profiles", function() {
        afterEach(function() {
            _.forEach(_.keys(profileApiService), function(key) {
                // Restore original methods if they are stubs
                if (_.has(profileApiService[key], 'restore')) {
                    profileApiService[key].restore();
                }
            });
            _.forEach(_.keys(taskProtocol), function(key) {
                // Restore original methods if they are stubs
                if (_.has(taskProtocol[key], 'restore')) {
                    taskProtocol[key].restore();
                }
            });
            _.forEach(_.keys(taskGraphProtocol), function(key) {
                // Restore original methods if they are stubs
                if (_.has(taskGraphProtocol[key], 'restore')) {
                    taskGraphProtocol[key].restore();
                }
            });
        });

        it("should send down redirect.ipxe if 'macs' are not in req.param", function() {
            return helper.request().get('/api/1.1/profiles')
                .expect(200)
                .expect(function() {
                    expect(profiles.get.calledWith('redirect.ipxe')).to.be.true;
                });
        });

        it("should send down redirect.ipxe if a node is new", function() {
            taskGraphProtocol.runTaskGraph = sinon.stub(
                taskGraphProtocol, 'runTaskGraph').resolves();
            return helper.request().get('/api/1.1/profiles')
                .query({ macs: '00:00:de:ad:be:ef' })
                .expect(200)
                .expect(function() {
                    expect(profiles.get.calledWith('redirect.ipxe')).to.be.true;
                });
        });

        it("should send down error.ipxe for a known node with no active graph", function() {
            profileApiService.createNodeAndRunDiscovery = sinon.stub(
                profileApiService, 'createNodeAndRunDiscovery').resolves({});
            profileApiService.getNode = sinon.stub(profileApiService, 'getNode').resolves({});
            taskGraphProtocol.getActiveTaskGraph = sinon.stub(
                taskGraphProtocol, 'getActiveTaskGraph').resolves(null);
            return helper.request().get('/api/1.1/profiles')
                .query({ macs: '00:00:de:ad:be:ef' })
                .expect(200)
                .expect(function() {
                    expect(profiles.get.calledWith('error.ipxe')).to.be.true;
                });
        });

        it("should send down error.ipxe on failing to retrieve workflow properties", function() {
            profileApiService.createNodeAndRunDiscovery = sinon.stub(
                profileApiService, 'createNodeAndRunDiscovery').resolves({});
            profileApiService.getNode = sinon.stub(profileApiService, 'getNode').resolves({});
            taskGraphProtocol.getActiveTaskGraph = sinon.stub(
                taskGraphProtocol, 'getActiveTaskGraph').resolves(true);
            taskProtocol.requestProfile = sinon.stub(
                taskProtocol, 'requestProfile').resolves('test.profile');
            taskProtocol.requestProperties = sinon.stub(taskProtocol, 'requestProperties').rejects(
                    new Error('Test workflow properties error'));
            return helper.request().get('/api/1.1/profiles')
                .query({ macs: '00:00:de:ad:be:ef' })
                .expect(200)
                .expect(function() {
                    expect(profiles.get.calledWith('error.ipxe')).to.be.true;
                });
        });

        it("should send down a task specific bootfile for a node with an active task", function() {
            profileApiService.createNodeAndRunDiscovery = sinon.stub(
                profileApiService, 'createNodeAndRunDiscovery').resolves({});
            profileApiService.getNode = sinon.stub(profileApiService, 'getNode').resolves({});
            taskGraphProtocol.getActiveTaskGraph = sinon.stub(
                taskGraphProtocol, 'getActiveTaskGraph').resolves(true);
            taskProtocol.requestProfile = sinon.stub(
                taskProtocol, 'requestProfile').resolves('test.profile');
            taskProtocol.requestProperties = sinon.stub(
                taskProtocol, 'requestProperties').resolves({});
            return helper.request().get('/api/1.1/profiles')
                .query({ macs: '00:00:de:ad:be:ef' })
                .expect(200)
                .expect(function() {
                    expect(profiles.get.calledWith('test.profile')).to.be.true;
                });
        });
    });
});
