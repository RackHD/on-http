// Copyright 2015-2016, EMC, Inc.

'use strict';

describe('Http.Api.Profiles', function () {
    var workflowApiService;
    var taskProtocol;
    var lookupService;
    var profiles;
    var profileApiService;
    var Errors;

    before('start HTTP server', function () {
        this.timeout(5000);
        return helper.startServer([]);
    });

    beforeEach('set up mocks', function () {
        taskProtocol = helper.injector.get('Protocol.Task');
        lookupService = helper.injector.get('Services.Lookup');
        Errors = helper.injector.get('Errors');

        sinon.stub(lookupService, 'ipAddressToMacAddress').resolves('00:00:00:00:00:00');

        sinon.stub(taskProtocol, 'activeTaskExists').resolves({});
        sinon.stub(taskProtocol, 'requestCommands').resolves({ testcommands: 'cmd' });
        sinon.stub(taskProtocol, 'requestProfile').resolves();
        sinon.stub(taskProtocol, 'requestProperties').resolves();

        workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
        sinon.stub(workflowApiService, 'findActiveGraphForTarget').resolves({});
        sinon.stub(workflowApiService, 'createActiveGraph').resolves({ instanceId: 'test' });

        profiles = helper.injector.get('Profiles');
        sinon.stub(profiles, 'getAll').resolves([]);
        sinon.stub(profiles, 'get').resolves('');
        sinon.stub(profiles, 'put').resolves();

        profileApiService = helper.injector.get('Http.Services.Api.Profiles');
        sinon.stub(profileApiService, 'getNode').resolves({});
        sinon.stub(profileApiService, 'createNodeAndRunDiscovery').resolves({});
        sinon.stub(profileApiService, 'runDiscovery').resolves({});
    });

    afterEach('teardown mocks', function () {
        function resetMocks(obj) {
            _(obj).methods().forEach(function (method) {
                if (typeof obj[method].restore === 'function') {
                    obj[method].restore();
                }
            }).value();
        }
        resetMocks(lookupService);
        resetMocks(taskProtocol);
        resetMocks(workflowApiService);
        resetMocks(profiles);
        resetMocks(profileApiService);
    });

    after('stop HTTP server', function () {
        return helper.stopServer();
    });

    var profile = {
        id: '1234abcd5678effe9012dcba',
        name: 'dummy profile',
        contents: '#!ipxe\n'
    };

    describe('GET /profiles/library', function () {
        it('should return a list of profiles', function () {
            profiles.getAll.resolves([profile]);
            return helper.request().get('/api/1.1/profiles/library')
            .expect('Content-Type', /^application\/json/)
            .expect(200, [profile])
            .then(function () {
                expect(profiles.getAll).to.have.been.calledOnce;
            });
        });
    });


    describe('GET /profiles/library/:id', function () {
        it('should return a single profile', function () {
            profiles.get.resolves(profile);
            return helper.request().get('/api/1.1/profiles/library/123')
            .expect('Content-Type', /^application\/json/)
            .expect(200, profile)
            .then(function () {
                expect(profiles.get).to.have.been.calledOnce;
                expect(profiles.get).to.have.been.calledWith('123');
            });
        });
    });

    describe('PUT /profiles/library/:id', function () {
        it('should save a profile', function () {
            profiles.put.resolves();
            return helper.request().put('/api/1.1/profiles/library/123')
            .set('Content-Type', 'application/octet-stream')
            .send('echo\n')
            .expect(200)
            .then(function () {
                expect(profiles.put).to.have.been.calledOnce;
                expect(profiles.put).to.have.been.calledWith('123');
                expect(profiles.put.firstCall.args[1]).to.deep.equal('echo\n');
            });
        });

        it('should 500 error when profiles.put() fails', function () {
            profiles.put.rejects(new Error('dummy'));
            return helper.request().put('/api/1.1/profiles/library/123')
            .send('test_profile_cmd\n')
            .expect('Content-Type', /^application\/json/)
            .expect(500);
        });
    });

    describe("GET /profiles", function() {
        it("should send down redirect.ipxe if 'macs' are not in req.query", function() {
            profileApiService.getNode.restore();
            return helper.request().get('/api/1.1/profiles')
                .expect(200)
                .expect(function() {
                    expect(profiles.get).to.have.been.calledWith('redirect.ipxe');
                });
        });

        it("should send down redirect.ipxe if a node is new", function() {
            profileApiService.getNode.restore();
            profileApiService.createNodeAndRunDiscovery.restore();
            return helper.request().get('/api/1.1/profiles')
                .query({ macs: '00:00:de:ad:be:ef' })
                .expect(200)
                .expect(function() {
                    expect(profiles.get).to.have.been.calledWith('redirect.ipxe');
                });
        });

        it("should send a 500 if profileApiService.getNode fails", function() {
            profileApiService.getNode.rejects(new Error('asdf'));

            return helper.request().get('/api/1.1/profiles')
                .query({ macs: '00:00:de:ad:be:ef' })
                .expect(500);
        });

        it("should send down error.ipxe for a known node with no active graph", function() {
            profileApiService.createNodeAndRunDiscovery.resolves({});
            profileApiService.getNode.resolves({});
            workflowApiService.findActiveGraphForTarget.resolves(null);

            return helper.request().get('/api/1.1/profiles')
                .query({ macs: '00:00:de:ad:be:ef' })
                .expect(200)
                .expect(function() {
                    expect(profiles.get).to.have.been.calledWith('error.ipxe');
                });
        });

        it("should send down error.ipxe on failing to retrieve workflow properties", function() {
            profileApiService.createNodeAndRunDiscovery.resolves({});
            profileApiService.getNode.resolves({});
            workflowApiService.findActiveGraphForTarget.resolves({});
            taskProtocol.requestProfile.resolves('test.profile');
            taskProtocol.requestProperties.rejects(new Error('Test workflow properties error'));

            return helper.request().get('/api/1.1/profiles')
                .query({ macs: '00:00:de:ad:be:ef' })
                .expect(200)
                .expect(function() {
                    expect(profiles.get).to.have.been.calledWith('error.ipxe');
                });
        });

        it("should send down a task specific bootfile for a node with an active task", function() {
            profileApiService.createNodeAndRunDiscovery.resolves({});
            profileApiService.getNode.resolves({});
            workflowApiService.findActiveGraphForTarget.resolves({});
            taskProtocol.requestProfile.resolves('test.profile');
            taskProtocol.requestProperties.resolves({});

            return helper.request().get('/api/1.1/profiles')
                .query({ macs: '00:00:de:ad:be:ef' })
                .expect(200)
                .expect(function() {
                    expect(profiles.get).to.have.been.calledWith('test.profile');
                });
        });
    });
});
