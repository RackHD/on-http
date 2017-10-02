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

    helper.httpServerBefore();

    before(function() {
        taskProtocol = helper.injector.get('Protocol.Task');
        lookupService = helper.injector.get('Services.Lookup');
        Errors = helper.injector.get('Errors');
        workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
        taskgraphApiService = helper.injector.get('Http.Services.Api.Taskgraph.Scheduler');
        profiles = helper.injector.get('Profiles');
        profileApiService = helper.injector.get('Http.Services.Api.Profiles');
        waterline = helper.injector.get('Services.Waterline');
    });

    beforeEach('set up mocks', function () {
        this.sandbox.stub(lookupService, 'ipAddressToMacAddress').resolves('00:00:00:00:00:00');
        this.sandbox.stub(taskProtocol, 'activeTaskExists').resolves({});
        this.sandbox.stub(taskProtocol, 'requestCommands').resolves({ testcommands: 'cmd' });
        this.sandbox.stub(taskProtocol, 'requestProfile').resolves();
        this.sandbox.stub(taskProtocol, 'requestProperties').resolves();

        this.sandbox.stub(workflowApiService, 'findActiveGraphForTarget').resolves({});

        this.sandbox.stub(taskgraphApiService, 'workflowsPost').resolves({ instanceId: 'test' });
        this.sandbox.stub(taskgraphApiService, 'profilesGetMetadata').resolves({});
        this.sandbox.stub(taskgraphApiService, 'profilesMetaGetByName').resolves({});

        this.sandbox.stub(profiles, 'getAll').resolves();
        this.sandbox.stub(profiles, 'getName').resolves();
        this.sandbox.stub(profiles, 'get').resolves();
        this.sandbox.stub(profiles, 'put').resolves();

        this.sandbox.stub(profileApiService, 'getNode').resolves({});
        this.sandbox.stub(profileApiService, 'createNodeAndRunDiscovery').resolves({});
        this.sandbox.stub(profileApiService, 'runDiscovery').resolves({});
        this.sandbox.stub(profileApiService, 'setLookup').resolves();
        this.sandbox.stub(profileApiService, 'profilesMetaGetByName').resolves();
        this.sandbox.stub(profileApiService, 'profilesPutLibByName').resolves();
        this.sandbox.stub(profileApiService, 'getMacAddressInRequest').resolves();

        this.sandbox.stub(waterline.lookups, "findOneByTerm").resolves();

        return helper.reset().then(function() {
            return helper.injector.get('Views').load();
        });
    });

    after(function () {
        return helper.reset();
    });

    helper.httpServerAfter();

    var profile = [{
        id: '1234abcd5678effe9012dcba',
        name: 'dummy_profile',
        contents: '#!ipxe\n',
        hash: '123',
        scope: 'dummy'
    }];

    describe('2.0 GET /profiles/metadata', function () {
        it('should return a list of profiles', function () {
            var profileMetadata =
            {
                "id": "e33202fc-f77c-40cc-8bab-037115c1de9a",
                "hash": "2Hmi/YDYFG9CezRfd4xVOA==",
                "name": "renasar-ansible.pub",
                "scope": "global"
            };
            taskgraphApiService.profilesGetMetadata.resolves([profileMetadata]);
            return helper.request().get('/api/2.0/profiles/metadata')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .then(function (res) {
                    res.body.forEach(function(item) {
                        expect(item.id).to.equal(profileMetadata.id);
                        expect(item.name).to.equal(profileMetadata.name);
                        expect(item.scope).to.equal(profileMetadata.scope);
                        expect(item.hash).to.equal(profileMetadata.hash);
                    });
                });
        });
    });

   describe('2.0 GET /profiles/metadata/:name', function () {
        it('should return a single profile', function () {
            var profileMetadata =
            {
                "id": "e33202fc-f77c-40cc-8bab-037115c1de9a",
                "hash": "2Hmi/YDYFG9CezRfd4xVOA==",
                "name": "renasar-ansible.pub",
                "scope": "global"
            };

            profileApiService.profilesMetaGetByName.resolves([profileMetadata]);
            taskgraphApiService.profilesMetaGetByName.resolves([profileMetadata]);

            return helper.request().get('/api/2.0/profiles/metadata/renasar-ansible.pub')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .then(function(res) {
                    expect(res.body[0]).to.have.property('name', 'renasar-ansible.pub');
                    expect(profileApiService.profilesMetaGetByName).to.have.been.calledOnce;
                    expect(profileApiService.profilesMetaGetByName).to.have.been.calledWith('renasar-ansible.pub');
                });
        });

        it('should return 404 for invalid profile name', function() {
            profileApiService.profilesMetaGetByName.rejects(new Errors.NotFoundError('invalid_profile'));

            return helper.request().get('/api/2.0/profiles/metadata/0000')
                .expect('Content-Type', /^application\/json/)
                .expect(404)
                .then(function() {
                    expect(profileApiService.profilesMetaGetByName).to.have.been.calledOnce;
                    expect(profileApiService.profilesMetaGetByName).to.have.been.calledWith('0000');
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
           var returnedPutValue ={
               "createdAt": "2017-09-14T18:18:38.489Z",
               "hash": "w9F3Ve/dOcnhcJBgkGUDZg==",
               "name": "ansible-external-inventory.js",
               "path": "/home/rackhd/git/2rackhd/rackhd/on-taskgraph/data/profiles/ansible-external-inventory.js",
               "scope": "global",
               "updatedAt": "2017-09-18T13:19:10.990Z",
               "id": "2d138ac3-0e70-4dee-ae30-b242658bd2a4"
           };
           profileApiService.profilesPutLibByName.resolves(returnedPutValue);
            return helper.request().put('/api/2.0/profiles/library/test.ipxe')
                .set('Content-Type', 'application/octet-stream')
                .send('string')
                .expect(201)
                .expect(function(){
                    expect(profileApiService.profilesPutLibByName).to.have.been.calledOnce;
                    expect(profileApiService.profilesPutLibByName).to.have.been.calledWith('test.ipxe');
                });
        });

       it('should 400 error when profiles.put() fails', function () {
           profileApiService.profilesPutLibByName.rejects(new Error('dummy'));

               return helper.request().put('/api/2.0/profiles/library/123')
               .send('test_profile_cmd\n')
               .expect('Content-Type', /^application\/json/)
               .expect(400);
       });
    });

    describe("2.0 GET /profiles/switch/:vendor", function() {
        it("should get switch profile via proxy", function() {
            this.sandbox.stub(profileApiService, 'getProfilesSwitchVendor').resolves(
                'switch_node_profile');
            this.sandbox.stub(profileApiService, 'renderProfile').resolves('#!ipxe\n');

            return helper.request()
                .get('/api/2.0/profiles/switch/testswitchvendor')
                .set("X-Real-IP", "188.1.1.1")
                .set("X-RackHD-API-proxy-ip", "127.0.0.1")
                .set("X-RackHD-API-proxy-port", "7180")
                .expect(200)
                .then(function() {
                    expect(profileApiService.getProfilesSwitchVendor).to.have.been.calledWith(
                        "188.1.1.1", "testswitchvendor");
                });
        });

        it("should get switch profile", function() {
            this.sandbox.stub(profileApiService, 'getProfilesSwitchVendor').resolves(
                'switch_node_profile');
            this.sandbox.stub(profileApiService, 'renderProfile').resolves('#!ipxe\n');
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
            this.sandbox.stub(profileApiService, 'getProfilesSwitchVendor').resolves();
            this.sandbox.stub(profileApiService, 'renderProfile').resolves();
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

        describe('GET /profiles/library/:name', function () {
            it('should return a single profiles', function () {
                var profileLib = {contents: "SWI=flash:/<%=bootfile%>"};
                profiles.get.resolves(profileLib);
                return helper.request().get('/api/2.0/profiles/library/test')
                    .expect(200, profileLib.contents)
                    .then(function() {
                        expect(profiles.get).to.have.been.calledWith('test');
                    });
            });

            it('should return 404 for invalid profiles name', function() {
                profiles.get.rejects();
                return helper.request().get('/api/2.0/profiles/library/test')
                    .then(function() {
                        expect(profiles.get).to.have.been.calledOnce;
                        expect(profiles.get).to.have.been.calledWith('test');
                    });
            });

        });

        describe('2.0 PUT /templates/library/:name', function () {
            it('should PUT new mockfile', function () {
                var returnedPutValue ={
                    "createdAt": "2017-09-14T18:18:38.489Z",
                    "hash": "w9F3Ve/dOcnhcJBgkGUDZg==",
                    "name": "ansible-external-inventory.js",
                    "path": "/home/rackhd/git/2rackhd/rackhd/on-taskgraph/data/profiles/ansible-external-inventory.js",
                    "scope": "global",
                    "updatedAt": "2017-09-18T13:19:10.990Z",
                    "id": "2d138ac3-0e70-4dee-ae30-b242658bd2a4"
                };
                profileApiService.profilesPutLibByName.resolves(returnedPutValue);
                return helper.request().put('/api/2.0/profiles/library/testTemplate')
                    .send('test\n')
                    .expect(201)
                    .expect(function(){
                        expect(profileApiService.profilesPutLibByName).to.have.been.calledOnce;
                        expect(profileApiService.profilesPutLibByName).to.have.been.calledWith('testTemplate');
                    });
            });

            it('should 400 error when profiles.put() fails', function () {
                profileApiService.profilesPutLibByName.rejects(new Error('dummy'));
                return helper.request().put('/api/2.0/profiles/library/123')
                    .send('test_template_foo\n')
                    .expect('Content-Type', /^application\/json/)
                    .expect(400);
            });
        });


    });
});
