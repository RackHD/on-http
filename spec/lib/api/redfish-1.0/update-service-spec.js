// Copyright © 2017 Dell Inc. or its subsidiaries.  All Rights Reserved.

'use strict';

describe('Redfish Update Service', function () {
    var redfish;
    var waterline;
    var workflow;
    var obmSettings = [
        {
            service: 'ipmi-obm-service',
            config: {
                host: '1.2.3.4',
                user: 'myuser',
                password: 'mypass'
            }
        }
    ];
    var badPayload = {"junk": "junk"};
    var goodPayload = {
        "ImageURI": "/home/rackhd/tmp/installer.exe",
        "Targets": ["58a4799ebaaafbe005dd0bc6"]
    };
    var mockNode = {id: '58a4799ebaaafbe005dd0bc6', type: 'compute'};

    before('start HTTP server', function () {
        var self = this;
        this.timeout(15000);
        this.sandbox = sinon.sandbox.create();

        return helper.startServer([], {authEnabled: false})
            .then(function () {
                redfish = helper.injector.get('Http.Api.Services.Redfish');
                waterline = helper.injector.get('Services.Waterline');
                workflow = helper.injector.get('Http.Services.Api.Workflows');

                self.sandbox.spy(redfish, 'validateSchema');
                self.sandbox.spy(redfish, 'handleError');
                self.sandbox.stub(waterline.obms, 'findAllByNode');
                self.sandbox.stub(waterline.nodes, 'getNodeById');
                self.sandbox.stub(workflow, 'createAndRunGraph');
            });
    });

    afterEach('tear down mocks', function () {
        this.sandbox.reset();
    });

    after('stop HTTP server', function () {
        this.sandbox.restore();
        return helper.stopServer();
    });

    it('should run a graph', function () {
        waterline.nodes.getNodeById.resolves(mockNode);
        waterline.obms.findAllByNode.resolves(obmSettings);
        workflow.createAndRunGraph.resolves();
        return helper.request().post(
            '/redfish/v1/UpdateService/Actions/UpdateService.SimpleUpdate'
        )
            .send(goodPayload)
            .expect(201)
            .expect(function () {
                expect(workflow.createAndRunGraph).to.have.been.calledOnce;
            });
    });

    it('should validate a bad request payload', function () {
        return helper.request().post(
            '/redfish/v1/UpdateService/Actions/UpdateService.SimpleUpdate'
        )
            .send(badPayload)
            .expect('Content-Type', /^application\/json/)
            .expect(400)
            .expect(function (response) {
                expect(response.body).to.have.property('errors');
            });
    });

    it('should return an error if a node is not found', function () {
        waterline.nodes.getNodeById.resolves(undefined);
        return helper.request().post(
            '/redfish/v1/UpdateService/Actions/UpdateService.SimpleUpdate'
        )
            .send(goodPayload)
            .expect('Content-Type', /^application\/json/)
            .expect(400)
            .expect(function (response) {
                expect(response.body).to.have.property('error');
                expect(redfish.handleError).to.have.been.calledOnce;
            });
    });

});