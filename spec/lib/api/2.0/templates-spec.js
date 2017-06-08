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

    before('start HTTP server', function () {
        this.timeout(5000);

        return helper.startServer([
        ]);
    });

    beforeEach('set up mocks', function () {
        taskProtocol = helper.injector.get('Protocol.Task');
        lookupService = helper.injector.get('Services.Lookup');
        Errors = helper.injector.get('Errors');
        waterline = helper.injector.get('Services.Waterline');
        swagger = helper.injector.get('Http.Services.Swagger');
        sinon.stub(swagger, 'makeRenderableOptions').resolves({});
        this.sandbox = sinon.sandbox.create();

        tasksApiService = helper.injector.get('Http.Services.Api.Tasks');
        tasksApiService.getNode = sinon.stub().resolves({ id: '1234abcd5678effe9012dcba' });

        nodeApiService = helper.injector.get('Http.Services.Api.Nodes');
        nodeApiService.getNodeByIdentifier = sinon.stub()
            .resolves({ id: '1234abcd5678effe9012dcba' });

        lookupService.ipAddressToMacAddress = sinon.stub().resolves('00:11:22:33:44:55');
        lookupService.reqIpAddressToMacAddress = sinon.stub().resolves();

        sinon.stub(taskProtocol, 'activeTaskExists').resolves({});
        sinon.stub(taskProtocol, 'requestCommands').resolves({ testcommands: 'cmd' });
        sinon.stub(taskProtocol, 'requestProfile').resolves();
        sinon.stub(taskProtocol, 'requestProperties').resolves();

        workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
        findActiveGraphForTarget = this.sandbox.stub(
            workflowApiService, 'findActiveGraphForTarget');

        templates = helper.injector.get('Templates');
        sinon.stub(templates, 'getAll').resolves();
        sinon.stub(templates, 'getName').resolves();
        sinon.stub(templates, 'get').resolves();
        sinon.stub(templates, 'put').resolves();
        sinon.stub(templates, 'unlink').resolves();
        sinon.stub(templates, 'render').resolves();

        return helper.injector.get('Views').load();
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
        resetMocks(templates);
        resetMocks(swagger);
    });

    after('stop HTTP server', function () {
        return helper.stopServer();
    });

    var template = {
        id: '1234abcd5678effe9012dcba',
        name: '123',
        scope: 'global',
        hash: '1234',
        contents: 'reboot'
    };

    describe('GET /templates/metadata', function () {
        it('should return a list of templates', function () {
            templates.getAll.resolves([template]);
            return helper.request().get('/api/2.0/templates/metadata')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .then(function (res) {
                    expect(templates.getAll).to.have.been.calledOnce;
                    res.body.forEach(function(item) {
                        expect(item.id).to.equal(template.id);
                        expect(item.name).to.equal(template.name);
                        expect(item.scope).to.equal(template.scope);
                        expect(item.hash).to.equal(template.hash);
                    });
                });
        });
    });

    describe('GET /templates/metadata/:name', function () {
        it('should return a single template', function () {
            templates.getName.resolves(template);
            return helper.request().get('/api/2.0/templates/metadata/123')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .then(function(res) {
                    expect(templates.getName).to.have.been.calledWith('123');
                    expect(res.body.id).to.equal(template.id);
                    expect(res.body.name).to.equal(template.name);
                    expect(res.body.scope).to.equal(template.scope);
                    expect(res.body.hash).to.equal(template.hash);
                });
        });

        it('should return 404 for invalid templates name', function() {
            templates.getName.rejects(new Errors.NotFoundError('bad_template'));
            return helper.request().get('/api/2.0/templates/metadata/test')
                .expect('Content-Type', /^application\/json/)
                .expect(404)
                .then(function() {
                    expect(templates.getName).to.have.been.calledOnce;
                    expect(templates.getName).to.have.been.calledWith('test');
                });
        });

    });

    describe('GET /templates/library/:name', function () {
        it('should return a single template', function () {
            templates.get.resolves(template);
            return helper.request().get('/api/2.0/templates/library/test')
                //.expect('Content-Type', /^application\/json/)
                .expect(200, template.contents)
                .then(function() {
                    expect(templates.get).to.have.been.calledWith('test');
                });
        });

        it('should return 404 for invalid templates name', function() {
            templates.get.rejects(new Errors.NotFoundError('bad_template'));
            return helper.request().get('/api/2.0/templates/library/test')
                .expect(404)
                .then(function() {
                    expect(templates.get).to.have.been.calledOnce;
                    expect(templates.get).to.have.been.calledWith('test');
                });
        });

    });

    describe('2.0 PUT /templates/library/:name', function () {
        it('should PUT new mockfile', function () {
            return helper.request().put('/api/2.0/templates/library/testTemplate')
                .send('test\n')
                .expect(201)
                .expect(function(){
                    expect(templates.put).to.have.been.calledOnce;
                    expect(templates.put).to.have.been.calledWith('testTemplate');
                });
        });

        it('should 400 error when templates.put() fails', function () {
            templates.put.rejects(new Error('dummy'));
            return helper.request().put('/api/2.0/templates/library/123')
                .send('test_template_foo\n')
                .expect('Content-Type', /^application\/json/)
                .expect(400);
        });
    });

    describe('GET SB /templates/:name', function () {
        it('should return a template with query nodeId', function () {
            var graph = {
                instanceId: '0123'
            };
            findActiveGraphForTarget.resolves(graph);
            taskProtocol.requestProperties.resolves({});
            return helper.request('http://localhost:8091')
                .get('/api/2.0/templates/123?nodeId=583ae29c68896e275779e2ff')
                .expect(200)
                .then(function () {
                    expect(templates.render).to.have.been.calledOnce;
                    expect(templates.render).to.have.been.calledWith('123');
                });
        });

        it('should return a template with query macs', function () {
            var graph = {
                instanceId: '0123'
            };
            findActiveGraphForTarget.resolves(graph);
            taskProtocol.requestProperties.resolves({});
            return helper.request('http://localhost:8091')
                .get('/api/2.0/templates/123?macs=00:50:56:aa:7d:85')
                .expect(200)
                .then(function () {
                    expect(templates.render).to.have.been.calledOnce;
                    expect(templates.render).to.have.been.calledWith('123');
                });
        });

        it('should return 400 when nodeId is not provided', function () {
            return helper.request('http://localhost:8091')
                .get('/api/2.0/templates/123')
                .expect('Content-Type', /^application\/json/)
                .expect(400)
                .expect(function (req) {
                    expect(req.body).to.have.property('message')
                        .to.equal('Neither query nodeId nor macs is provided.');
                });
        });
    });

    describe('2.0 delete /templates/library/:name', function () {
        it('should delete a template', function () {
            return helper.request().delete('/api/2.0/templates/library/test_foo')
                .expect(200);
        });
    });

});
