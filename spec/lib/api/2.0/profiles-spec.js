// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved.

'use strict';

describe('Http.Api.Profiles', function () {
    var workflowApiService;
    var taskProtocol;
    var lookupService;
    var profiles;
    var profileApiService;
    var taskgraphApiService;
    var Errors;
    var waterline;

    before('start HTTP server', function () {
        this.timeout(10000);
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

        taskgraphApiService = helper.injector.get('Http.Services.Api.Taskgraph.Scheduler');
        sinon.stub(taskgraphApiService, 'workflowsPost').resolves({ instanceId: 'test' });

        profiles = helper.injector.get('Profiles');
        sinon.stub(profiles, 'getAll').resolves();
        sinon.stub(profiles, 'getName').resolves();
        sinon.stub(profiles, 'get').resolves();
        sinon.stub(profiles, 'put').resolves();

        profileApiService = helper.injector.get('Http.Services.Api.Profiles');
        sinon.stub(profileApiService, 'getNode').resolves({});
        sinon.stub(profileApiService, 'createNodeAndRunDiscovery').resolves({});
        sinon.stub(profileApiService, 'runDiscovery').resolves({});
        sinon.stub(profileApiService, 'setLookup').resolves();

        waterline = helper.injector.get('Services.Waterline');
        sinon.stub(waterline.lookups, "findOneByTerm").resolves();

        return helper.reset().then(function() {
            return helper.injector.get('Views').load();
        });
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
        resetMocks(taskgraphApiService);
        resetMocks(waterline.lookups);
    });

    after('stop HTTP server', function () {
        return helper.reset().then(function() {
            return helper.stopServer();
        });
    });

    var profile = [{
        id: '1234abcd5678effe9012dcba',
        name: 'dummy_profile',
        contents: '#!ipxe\n',
        hash: '123',
        scope: 'dummy'
    }];

    describe('2.0 GET /profiles/metadata', function () {
        it('should return a list of profiles', function () {
            profiles.getAll.resolves(profile);

            return helper.request().get('/api/2.0/profiles/metadata')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .then(function(res) {
                    expect(res.body[0]).to.have.property('name', 'dummy_profile');
                    expect(res.body[0]).to.have.property('scope', 'dummy');
		            expect(res.body[0]).to.have.property('hash', '123');
                    expect(profiles.getAll).to.have.been.calledOnce;
                });
        });
    });

    describe('2.0 GET /profiles/metadata/:name', function () {
        it('should return a single profile', function () {
            profiles.getName.resolves(profile);

            return helper.request().get('/api/2.0/profiles/metadata/dummy_profile')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .then(function(res) {
                    expect(res.body[0]).to.have.property('name', 'dummy_profile');
                    expect(profiles.getName).to.have.been.calledOnce;
                    expect(profiles.getName).to.have.been.calledWith('dummy_profile');
                });
        });

        it('should return 404 for invalid profile name', function() {
            profiles.getName.rejects(new Errors.NotFoundError('invalid_profile'));

            return helper.request().get('/api/2.0/profiles/metadata/0000')
                .expect('Content-Type', /^application\/json/)
                .expect(404)
                .then(function() {
                    expect(profiles.getName).to.have.been.calledOnce;
                    expect(profiles.getName).to.have.been.calledWith('0000');
                });
        });
    });

    describe('2.0 GET /profiles/library/:name', function() {
        it('should get profile by name', function() {
            profiles.get.resolves(profile[0]);

            return helper.request().get('/api/2.0/profiles/library/dummy_profile?scope=dummy')
                .expect(200)
                .then(function(res) {
                    expect(res.text).to.equal('#!ipxe\n');
                    expect(profiles.get).to.have.been.calledOnce;
                    expect(profiles.get).to.have.been.calledWith('dummy_profile', 'dummy');
                });
        });

        it('should return 404 on invalid profile name', function() {
            profiles.get.rejects(new Errors.NotFoundError('invalid profile'));

            return helper.request().get('/api/2.0/profiles/library/0000?scope=dummy')
                .expect(404)
                .then(function() {
                    expect(profiles.get).to.have.been.calledOnce;
                    expect(profiles.get).to.have.been.calledWith('0000');
                });
        });
    });

    describe('2.0 PUT /profiles/library/:name', function () {
        it('should PUT new mockfile', function () {
            return helper.request().put('/api/2.0/profiles/library/test.ipxe')
                .set('Content-Type', 'application/octet-stream')
                .send('string')
                .expect(201)
                .expect(function(){
                    expect(profiles.put).to.have.been.calledOnce;
                    expect(profiles.put).to.have.been.calledWith('test.ipxe');
                });
        });

        it('should 400 error when profiles.put() fails', function () {
            profiles.put.rejects(new Error('dummy'));

            return helper.request().put('/api/2.0/profiles/library/123')
                .send('test_profile_cmd\n')
                .expect('Content-Type', /^application\/json/)
                .expect(400);
        });
    });

    describe("SB 2.0 GET /profiles", function() {
        it("should receive both mac and ip query", function() {
            return helper.request().get('/api/2.0/profiles?mac=00:01:02:03:04:05&&ip=1.1.1.1')
                .expect(200)
                .expect(function() {
                    expect(profileApiService.setLookup).to.have.been.calledOnce;
                });
        });

        it("should send 500 set mac and ip fails", function() {
            profileApiService.setLookup.rejects(new Error('error'));

            return helper.request().get('/api/2.0/profiles?mac=00:01:02:03:04:05&&ip=1.1.1.1')
                .expect(500);
        });

        it("should call getNode with a compute node type", function() {
            return helper.request().get('/api/2.0/profiles')
                .query({ macs: [ '00:01:02:03:04:05' ], ips: [ '172.31.128.5' ] })
                .expect(200)
                .expect(function() {
                    expect(profileApiService.getNode).to.have.been.calledWith(
                        [ '00:01:02:03:04:05' ],
                        { type: 'compute' }
                    );
                });
        });

        it("should send down redirect.ipxe if 'macs' are not in req.query", function() {
            profileApiService.getNode.restore();

            return helper.request().get('/api/2.0/profiles')
                .expect(200)
                .expect(function() {
                    expect(profiles.get).to.have.been.calledWith('redirect.ipxe');
                });
        });

        it("should send down redirect.ipxe if a node is new", function() {
            profileApiService.getNode.restore();
            profileApiService.createNodeAndRunDiscovery.restore();

            return helper.request().get('/api/2.0/profiles')
                .query({ macs: '00:00:de:ad:be:ef', ips: '172.31.128.5' })
                .expect(200)
                .expect(function() {
                    expect(profiles.get).to.have.been.calledWith('redirect.ipxe');
                });
        });

        it("should send a 500 if profileApiService.getNode fails", function() {
            profileApiService.getNode.rejects(new Error('asdf'));

            return helper.request().get('/api/2.0/profiles')
                .query({ macs: '00:00:de:ad:be:ef', ips: '172.31.128.5' })
                .expect(500);
        });

        it("should send a 200 for a known node with no active graph", function() {
            profileApiService.createNodeAndRunDiscovery.resolves({});
            profileApiService.getNode.resolves({});
            workflowApiService.findActiveGraphForTarget.resolves(null);

            return helper.request().get('/api/2.0/profiles')
                .query({ macs: '00:00:de:ad:be:ef', ips: '172.31.128.5' })
                .expect(200);
        });

        it("should send a 503 on failing to retrieve workflow properties", function() {
            profileApiService.createNodeAndRunDiscovery.resolves({});
            profileApiService.getNode.resolves({});
            workflowApiService.findActiveGraphForTarget.resolves({});
            taskProtocol.requestProfile.resolves('test.profile');
            taskProtocol.requestProperties.rejects(new Error('Test workflow properties error'));

            return helper.request().get('/api/2.0/profiles')
                .query({ macs: '00:00:de:ad:be:ef', ips: '172.31.128.5' })
                .expect(503)
                .then(function(resp) {
                    expect(resp.body.message).to.equal(
                        'Error: Unable to retrieve workflow properties or profiles');
                });
        });

        it("should send down a task specific bootfile for a node with an active task", function() {
            profileApiService.createNodeAndRunDiscovery.resolves({});
            profileApiService.getNode.resolves({});
            workflowApiService.findActiveGraphForTarget.resolves({});
            taskProtocol.requestProfile.resolves('test.profile');
            taskProtocol.requestProperties.resolves({});

            return helper.request().get('/api/2.0/profiles')
                .query({ macs: '00:00:de:ad:be:ef', ips: '172.31.128.5' })
                .expect(200)
                .expect(function() {
                    expect(profiles.get).to.have.been.calledWith('test.profile');
                });
        });
    });

    describe("2.0 GET /profiles/switch/:vendor", function() {
        it("should get switch profile via proxy", function() {
            sinon.stub(profileApiService, 'getProfilesSwitchVendor').resolves(
                'switch_node_profile');
            sinon.stub(profileApiService, 'renderProfile').resolves('#!ipxe\n');

            return helper.request()
                .get('/api/2.0/profiles/switch/testswitchvendor')
                .set("X-Real-IP", "188.1.1.1")
                .set("X-RackHD-API-proxy-ip", "127.0.0.1")
                .set("X-RackHD-API-proxy-port", "7180")
                .expect(200)
                .then(function(res) {
                    expect(profileApiService.getProfilesSwitchVendor).to.have.been.calledWith(
                        "188.1.1.1", "testswitchvendor");
                });
        });

        it("should get switch profile", function() {
            sinon.stub(profileApiService, 'getProfilesSwitchVendor').resolves(
                'switch_node_profile');
            sinon.stub(profileApiService, 'renderProfile').resolves('#!ipxe\n');
            waterline.lookups.findOneByTerm.resolves({macAddress: '11:11:11:11:11:11'});
            profileApiService.getProfilesSwitchVendor.resolves('switch_node_profile');
            profileApiService.renderProfile.resolves('#!ipxe\n');

            return helper.request().get('/api/2.0/profiles/switch/testswitchvendor')
                .expect(200)
                .then(function(res) {
                    expect(profileApiService.renderProfile).to.have.been.calledWith(
                        'switch_node_profile'
                    );
                    expect(res.text).to.equal('#!ipxe\n');
                });
        });

        it("should send a 500 if profileApiService.getNode fails", function() {
            waterline.lookups.findOneByTerm.resolves({macAddress: '11:11:11:11:11:11'});
            profileApiService.getNode.rejects(new Errors.InternalServerError('test'));

            return helper.request().get('/api/2.0/profiles/switch/testswitchvendor')
                .expect(500);
        });

        it("should return 404 for invalid switch vendor name", function() {
            sinon.stub(profileApiService, 'getProfilesSwitchVendor').resolves();
            sinon.stub(profileApiService, 'renderProfile').resolves();
            waterline.lookups.findOneByTerm.resolves({macAddress: '11:11:11:11:11:11'});
            profileApiService.getProfilesSwitchVendor.rejects(new Errors.NotFoundError(
                'invalid switch name'));

            return helper.request().get('/api/2.0/profiles/switch/testswitchvendor')
                .expect(404)
                .then(function() {
                    expect(profileApiService.renderProfile).to.have.not.been.called;
                });
        });

        it("should return a 400 for a known node with no active graph", function() {
            waterline.lookups.findOneByTerm.resolves({macAddress: '11:11:11:11:11:11'});
            profileApiService.getNode.resolves({ type: 'switch' });
            workflowApiService.findActiveGraphForTarget.resolves(null);

            return helper.request().get('/api/2.0/profiles/switch/testswitchvendor')
                .expect(200);
        });

        it("should return a 503 on failing to retrieve workflow properties", function() {
            waterline.lookups.findOneByTerm.resolves({macAddress: '11:11:11:11:11:11'});
            profileApiService.getNode.resolves({ type: 'switch' });
            workflowApiService.findActiveGraphForTarget.resolves({});
            taskProtocol.requestProfile.resolves('test.profile');
            taskProtocol.requestProperties.rejects(new Error('Test workflow properties error'));

            return helper.request().get('/api/2.0/profiles/switch/testswitchvendor')
                .expect(503)
                .then(function(resp) {
                    expect(resp.body.message).to.equal(
                        'Error: Unable to retrieve workflow properties or profiles');
                });
        });

        it("should return a task specific profile for a switch with an active task", function() {
            waterline.lookups.findOneByTerm.resolves({macAddress: '11:11:11:11:11:11'});
            profileApiService.getNode.resolves({ type: 'switch' });
            workflowApiService.findActiveGraphForTarget.resolves({});
            taskProtocol.requestProfile.resolves('test.profile');
            taskProtocol.requestProperties.resolves({});

            return helper.request().get('/api/2.0/profiles/switch/testswitchvendor')
                .expect(200)
                .expect(function() {
                    expect(profiles.get).to.have.been.calledWith('test.profile');
                });
        });

        it("should throw a 400 on a request from an unknown switch vendor", function() {
            waterline.lookups.findOneByTerm.resolves({macAddress: '11:11:11:11:11:11'});
            profileApiService.getNode.restore();
            profileApiService.createNodeAndRunDiscovery.restore();
            profileApiService.runDiscovery.restore();
            taskProtocol.activeTaskExists.rejects(new Error('test'));

            return helper.request().get('/api/2.0/profiles/switch/unknown')
                .expect(400, /Unknown.*vendor/);
        });

        it("should return 404 for unkown mac address", function() {
            waterline.lookups.findOneByTerm.rejects(new Errors.NotFoundError(
                'unknown mac address'));

            return helper.request().get('/api/2.0/profiles/switch/testswitchvendor')
                .expect(404)
                .then(function() {
                    expect(profileApiService.getNode).to.have.not.been.called;
                });
        });
    });
});
