// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved.
'use strict';

describe('Http.Api.Templates', function () {
    var workflowApiService;
    var taskProtocol;
    var lookupService;
    var templates;
    var Errors;
    var waterline;
    var swagger;
    var tasksApiService;
    var findActiveGraphForTarget;
    var nodeApiService;
    var templatesApiService = {};


    helper.httpServerBefore([
        dihelper.simpleWrapper(templatesApiService, 'Http.Services.Api.Templates')
    ]);

    before(function() {
        taskProtocol = helper.injector.get('Protocol.Task');
        lookupService = helper.injector.get('Services.Lookup');
        Errors = helper.injector.get('Errors');
        waterline = helper.injector.get('Services.Waterline');
        swagger = helper.injector.get('Http.Services.Swagger');
        tasksApiService = helper.injector.get('Http.Services.Api.Tasks');
        nodeApiService = helper.injector.get('Http.Services.Api.Nodes');
        workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
        templates = helper.injector.get('Templates');
        return helper.injector.get('Views').load();
    });
    beforeEach(function() {
        this.sandbox.reset();
    });

    after(function () {
        this.sandbox.restore();
    });

    beforeEach('set up mocks', function () {
        this.sandbox.stub(swagger, 'makeRenderableOptions').resolves({});
        tasksApiService.getNode = this.sandbox.stub().resolves({ id: '1234abcd5678effe9012dcba' });
        nodeApiService.getNodeByIdentifier = this.sandbox.stub()
            .resolves({ id: '1234abcd5678effe9012dcba' });
        lookupService.ipAddressToMacAddress = this.sandbox.stub().resolves('00:11:22:33:44:55');
        lookupService.reqIpAddressToMacAddress = this.sandbox.stub().resolves();
        this.sandbox.stub(taskProtocol, 'activeTaskExists').resolves({});
        this.sandbox.stub(taskProtocol, 'requestCommands').resolves({ testcommands: 'cmd' });
        this.sandbox.stub(taskProtocol, 'requestProfile').resolves();
        this.sandbox.stub(taskProtocol, 'requestProperties').resolves();

        findActiveGraphForTarget = this.sandbox.stub(
            workflowApiService, 'findActiveGraphForTarget');

        templatesApiService.templatesLibPut = this.sandbox.stub();  
        templatesApiService.templatesLibGet = this.sandbox.stub();
        templatesApiService.templatesMetaGet = this.sandbox.stub();
        templatesApiService.templatesMetaGetByName = this.sandbox.stub();

        this.sandbox.stub(templates, 'getAll').resolves();
        this.sandbox.stub(templates, 'getName').resolves();
        this.sandbox.stub(templates, 'get').resolves();
        this.sandbox.stub(templates, 'put').resolves();
        this.sandbox.stub(templates, 'unlink').resolves();
        this.sandbox.stub(templates, 'render').resolves();
    });

    helper.httpServerAfter();

    describe('GET /templates/metadata', function () {
        it('should return a list of templates metadata', function () {
            var templateMetadata =
            {
                    "id": "e33202fc-f77c-40cc-8bab-037115c1de9a",
                    "hash": "2Hmi/YDYFG9CezRfd4xVOA==",
                    "name": "renasar-ansible.pub",
                    "scope": "global"
            };
            templatesApiService.templatesMetaGet.resolves([templateMetadata]);
            return helper.request().get('/api/2.0/templates/metadata')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .then(function (res) {
                    res.body.forEach(function(item) {
                        expect(item.id).to.equal(templateMetadata.id);
                        expect(item.name).to.equal(templateMetadata.name);
                        expect(item.scope).to.equal(templateMetadata.scope);
                        expect(item.hash).to.equal(templateMetadata.hash);
                    });
                });
        });
    });

    describe('GET /templates/metadata/:name', function () {
        it('should return a single template metadata', function () {
            var templateMetadataByName=
                {
                    "id": "e33202fc-f77c-40cc-8bab-037115c1de9a",
                    "hash": "2Hmi/YDYFG9CezRfd4xVOA==",
                    "name": "renasar-ansible.pub",
                    "scope": "global"
                };
            templatesApiService.templatesMetaGetByName.resolves([templateMetadataByName]);
            return helper.request().get('/api/2.0/templates/metadata/123')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .then(function(res) {
                    expect(templatesApiService.templatesMetaGetByName).to.have.been.calledWith('123');
                    expect(res.body[0].id).to.equal(templateMetadataByName.id);
                    expect(res.body[0].name).to.equal(templateMetadataByName.name);
                    expect(res.body[0].scope).to.equal(templateMetadataByName.scope);
                    expect(res.body[0].hash).to.equal(templateMetadataByName.hash);
                });
        });

        it('should return 404 for invalid templates name', function() {
            templatesApiService.templatesMetaGetByName.rejects(new Errors.NotFoundError('bad_template'));
            return helper.request().get('/api/2.0/templates/metadata/test')
                .expect('Content-Type', /^application\/json/)
                .expect(404)
                .then(function() {
                    expect(templatesApiService.templatesMetaGetByName).to.have.been.calledOnce;
                    expect(templatesApiService.templatesMetaGetByName).to.have.been.calledWith('test');
                });
        });

    });

    describe('GET /templates/library/:name', function () {
        it('should return a single template', function () {
            var templateLib = "SWI=flash:/<%=bootfile%>";
            templatesApiService.templatesLibGet.resolves(templateLib);
            return helper.request().get('/api/2.0/templates/library/test')
                .expect(200, templateLib)
                .then(function() {
                    expect(templatesApiService.templatesLibGet).to.have.been.calledWith('test');
                });
        });

        it('should return 404 for invalid templates name', function() {
            templatesApiService.templatesLibGet.rejects(new Errors.NotFoundError('bad_template'));
            return helper.request().get('/api/2.0/templates/library/test')
                .then(function() {
                    expect(templatesApiService.templatesLibGet).to.have.been.calledOnce;
                    expect(templatesApiService.templatesLibGet).to.have.been.calledWith('test');
                });
        });

    });

    describe('2.0 PUT /templates/library/:name', function () {
        it('should PUT new mockfile', function () {
            var returnedPutValue ={
                "createdAt": "2017-09-14T18:18:38.489Z",
                "hash": "w9F3Ve/dOcnhcJBgkGUDZg==",
                "name": "ansible-external-inventory.js",
                "path": "/home/rackhd/git/2rackhd/rackhd/on-taskgraph/data/templates/ansible-external-inventory.js",
                "scope": "global",
                "updatedAt": "2017-09-18T13:19:10.990Z",
                "id": "2d138ac3-0e70-4dee-ae30-b242658bd2a4"
            };
            templatesApiService.templatesLibPut.resolves(returnedPutValue);
            return helper.request().put('/api/2.0/templates/library/testTemplate')
                .send('test\n')
                .expect(201)
                .expect(function(){
                    expect(templatesApiService.templatesLibPut).to.have.been.calledOnce;
                    expect(templatesApiService.templatesLibPut).to.have.been.calledWith('testTemplate');
                });
        });

        it('should 400 error when templates.put() fails', function () {
            templatesApiService.templatesLibPut.rejects(new Error('dummy'));
            return helper.request().put('/api/2.0/templates/library/123')
                .send('test_template_foo\n')
                .expect('Content-Type', /^application\/json/)
                .expect(400);
        });
    });

   //TODO update the delete unit test to support grpc call	
   /* describe('2.0 delete /templates/library/:name', function () {
        it('should delete a template', function () {
            return helper.request().delete('/api/2.0/templates/library/test_foo')
                .expect(200);
        });
    });*/

});
