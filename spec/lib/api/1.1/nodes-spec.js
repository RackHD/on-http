// Copyright 2015-2016, EMC, Inc.

'use strict';

describe('Http.Api.Nodes v1.1', function () {
    var configuration;
    var waterline;
    var ObmService;
    var workflowApiService;
    var nodesApiService;
    var lookupService;
    var Promise;
    var Constants;
    var Errors;

    before('start HTTP server', function () {
        this.timeout(5000);
        return helper.startServer([
        ]).then(function () {
            configuration = helper.injector.get('Services.Configuration');
            lookupService = helper.injector.get('Services.Lookup');
            lookupService.ipAddressToMacAddress = sinon.stub().resolves();
            lookupService.ipAddressToNodeId = sinon.stub().resolves();
            sinon.stub(configuration);

            waterline = helper.injector.get('Services.Waterline');
            sinon.stub(waterline.nodes);
            waterline.nodes = {
                find: sinon.stub(),
                findOne: sinon.stub(),
                needByIdentifier: sinon.stub(),
                updateByIdentifier: sinon.stub()
            };
            sinon.stub(waterline.obms);
            waterline.obms = {
                find: sinon.stub(),
                upsertByNode: sinon.stub(),
                findByNode: sinon.stub()
            };
            sinon.stub(waterline.catalogs);
            sinon.stub(waterline.workitems);
            sinon.stub(waterline.graphobjects);
            ObmService = helper.injector.get('Task.Services.OBM');
            sinon.stub(ObmService.prototype, 'identifyOn');
            sinon.stub(ObmService.prototype, 'identifyOff');
            sinon.stub(ObmService, 'checkValidService');
            workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
            nodesApiService = helper.injector.get('Http.Services.Api.Nodes');
            sinon.stub(workflowApiService);
            sinon.stub(nodesApiService, "getAllNodes");
            sinon.stub(nodesApiService, "getNodeById");
            sinon.stub(nodesApiService, "patchNodeById");
            sinon.stub(nodesApiService, "getNodeObmById");
            sinon.stub(nodesApiService, "postNodeObmIdById");

            Promise = helper.injector.get('Promise');
            Constants = helper.injector.get('Constants');
            Errors = helper.injector.get('Errors');

        });

    });

    beforeEach('reset stubs', function () {
        function resetStubs(obj) {
            _(obj).methods().forEach(function (method) {
                if (obj[method] && obj[method].reset) {
                  obj[method].reset();
                }
            }).value();
        }

        resetStubs(configuration);
        resetStubs(lookupService);
        resetStubs(waterline.lookups);
        resetStubs(waterline.nodes);
        resetStubs(waterline.catalogs);
        resetStubs(waterline.workitems);
        resetStubs(waterline.graphobjects);
        resetStubs(workflowApiService);

        ObmService.prototype.identifyOn.reset();
        ObmService.prototype.identifyOff.reset();

        lookupService = helper.injector.get('Services.Lookup');
        lookupService.ipAddressToMacAddress = sinon.stub().resolves();
        lookupService.ipAddressToNodeId = sinon.stub().resolves();
    });

    after('stop HTTP server', function () {
        return helper.stopServer();
    });

// OBM model mock data, that has config/id/node/service 
    var obm = [{
        config: {},
        id: '574dcd5794ab6e2506fd107a',
        node: '1234abcd1234abcd1234abcd',
        service: 'noop-obm-service'
    }];

// OBM model handles all obm related ACTIONS. nodeModelData mocks node 
// functionality and excludes obms/ObmSettings
    var nodeModelData = {
        autoDiscover: "false",
        id: '1234abcd1234abcd1234abcd',
        name: 'name',
        identifiers: [],
        tags: [],
        type: 'compute'
    };

// NODE by default displays obms from OBM model. Later
// it is modified in 1.1 controller ( refer obm mock data)
    var node = {
        autoDiscover: "false",
        id: '1234abcd1234abcd1234abcd',
        name: 'name',
        identifiers: [],
        tags: [],
        obms:  obm,
        type: 'compute',
        toJSON: function () { return nodeModelData; }
    };

// NODE by default displays obms from OBM model. Later
// it is modified in 1.1 controller ( refer obm mock data)
    var modifiedNode = {
        autoDiscover: "false",
        id: '1234abcd1234abcd1234abcd',
        name: 'name',
        identifiers: [],
        tags: [],
        obmSettings: [{
            service: 'noop-obm-service',
            config:{}
        }],
        type: 'compute'
    };

// MOCK data to test _renderNodeObmSettings function
// OBM display data, for 1.1 display of ObmSettings only. Removes id/node data.

    var obmModelData =
        {
            service: 'noop-obm-service',
            config: {},
            toJSON: function () { return modifiedNode; }

        };

// MOCK data to test _renderNodeObmSettings function
    var obmModel = {
        node: "57727d4a6db8af4e06474b47",
        config: {
            host: "localhost",
            user: "admin"
        },
        service: "nooop-obm-service",
        createdAt: "2016-06-28T14:58:52.779Z",
        updatedAt: "2016-06-28T14:58:52.779Z",
        id: "577290ac05d51fca0f20eb28",
        toJSON: function () { return obmModelData; }
    };

    describe('GET /nodes', function () {
        it('should return a list of nodes', function () {
            nodesApiService.getAllNodes.resolves([node]);
            waterline.nodes.find.resolves([node]);
            waterline.obms.find.returns(Promise.resolve([obmModel]));


            return helper.request().get('/api/1.1/nodes')
                .expect('Content-Type', /^application\/json/)
                .expect(200, [modifiedNode]);
        });
    });

    describe('POST /nodes', function () {
        beforeEach(function() {
            sinon.stub(nodesApiService, 'postNode');
        });

        afterEach(function() {
            nodesApiService.postNode.restore();
        });

        it('should create a node', function () {
            nodesApiService.postNode.resolves(nodeModelData);

            return helper.request().post('/api/1.1/nodes')
                .send(nodeModelData)
                .expect('Content-Type', /^application\/json/)
                .expect(201, nodeModelData)
                .expect(function () {
                    expect(nodesApiService.postNode).to.have.been.calledOnce;
                    expect(nodesApiService.postNode.firstCall.args[0])
                        .to.have.property('id').that.equals(nodeModelData.id);
                });
        });
    });


    describe('GET /nodes/:id', function () {
        it('should return a single node', function () {
            nodesApiService.getNodeById.resolves(node);
            waterline.nodes.find.resolves(node);
            waterline.obms.find.returns(Promise.resolve([obmModel]));

            return helper.request().get('/api/1.1/nodes/1234')
                .expect('Content-Type', /^application\/json/)
                .expect(200, modifiedNode)
                .expect(function () {
                    expect(nodesApiService.getNodeById).to.have.been.called;

                });
        });

        it('should return 404 if the node was not found', function () {
            waterline.nodes.findOne.resolves([]);
            nodesApiService.getNodeById.rejects(new Errors.NotFoundError('Node not found'));

            return helper.request().get('/api/1.1/nodes/1234')
                .expect(404, '{"message":"Node not found"}');
        });
    });


    describe('PATCH /nodes/:identifier', function () {

        it('should update a node', function () {
            waterline.nodes.needByIdentifier.returns(Promise.resolve(nodeModelData));
            waterline.nodes.updateByIdentifier.returns(Promise.resolve(nodeModelData));
            nodesApiService.patchNodeById.returns(Promise.resolve(node));
            waterline.obms.upsertByNode.returns(Promise.resolve([node]));
            waterline.obms.find.returns(Promise.resolve([obmModel]));

            return helper.request().patch('/api/1.1/nodes/1234')
                .send(modifiedNode)
                .expect('Content-Type', /^application\/json/)
                .expect(200, modifiedNode);
        });

        it('should return a 404 if the node was not found', function () {
            nodesApiService.patchNodeById.rejects(new Errors.NotFoundError('Node not found'));
            waterline.nodes.needByIdentifier.rejects(new Errors.NotFoundError('Not Found'));

            return helper.request().patch('/api/1.1/nodes/1234')
                .send(node)
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });


    describe('DELETE /nodes/:identifier', function () {
        beforeEach(function() {
            sinon.stub(nodesApiService, 'removeNode');
        });

        afterEach(function() {
            nodesApiService.removeNode.restore();
        });

        it('should delete a node', function () {
            var nodesApiService = helper.injector.get('Http.Services.Api.Nodes');

            waterline.nodes.needByIdentifier.resolves(nodeModelData);
            nodesApiService.removeNode.resolves(nodeModelData);

            return helper.request().delete('/api/1.1/nodes/1234')
                .expect('Content-Type', /^application\/json/)
                .expect(200, nodeModelData)
                .expect(function () {
                    expect(nodesApiService.removeNode).to.have.been.calledOnce;
                });
        });

        it('should return a 404 if the node was not found', function () {
            waterline.nodes.needByIdentifier.rejects(new Errors.NotFoundError('Not Found'));

            return helper.request().delete('/api/1.1/nodes/1234')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });

    describe('GET /nodes/:identifier/obm', function () {
        it('should return a list of the node\'s OBM settings', function () {
        var retObm =
            [{
                service: 'noop-obm-service',
                config: {}
            }];

            waterline.nodes.needByIdentifier.returns(Promise.resolve(node));
            nodesApiService.getNodeObmById.resolves(Promise.resolve(node));


            return helper.request().get('/api/1.1/nodes/1234/obm')
                .expect('Content-Type', /^application\/json/)
                .expect(200, retObm);
        });

        it('should return a 404 if the node was not found', function () {
            waterline.nodes.needByIdentifier.rejects(new Errors.NotFoundError('Not Found'));
            nodesApiService.getNodeObmById.rejects(new Errors.NotFoundError('Not found'));

            return helper.request().get('/api/1.1/nodes/1234/obm')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });

        it('should return a 404 if the node has no OBM settings', function () {
            waterline.nodes.needByIdentifier.resolves({ id: nodeModelData.id });

            return helper.request().get('/api/1.1/nodes/1234/obm')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });

    describe('POST /nodes/:identifier/obm', function () {
        var outputNode = {
            autoDiscover: "false",
            id: '1234abcd1234abcd1234abcd',
            name: 'name',
            identifiers: [],
            tags: [],
            obmSettings: [{
            service: 'ipmi-obm-service',
            config: {
                'host': '5.6.7.8',
                'user': 'myuser2',
                'password': 'mypass2'
            }
            }],
            type: 'compute'
        };

        var serializedObmSetting = {
            service: 'ipmi-obm-service',
            config: {
                'host': '5.6.7.8',
                'user': 'myuser2',
                'password': 'REDACTED'
            },
           toJSON: function () { return outputNode; }
        };

        var obmSetting = {
            service: 'ipmi-obm-service',
            config: {
                'host': '5.6.7.8',
                'user': 'myuser2',
                'password': 'mypass2'
            },
            toJSON: function () { return serializedObmSetting; }
        };

        var outputObmSetting = {
            service: 'ipmi-obm-service',
            config: {
                'host': '5.6.7.8',
                'user': 'myuser2',
                'password': 'REDACTED'
            }
        };
        it('should add a new set of OBM settings if none exist', function () {
            waterline.nodes.needByIdentifier.returns(Promise.resolve(node));
            waterline.obms.find.returns(Promise.resolve([obmModel]));
            waterline.obms.upsertByNode.returns(Promise.resolve([node]));

            waterline.nodes.updateByIdentifier.returns(Promise.resolve(nodeModelData));
            waterline.obms.find.returns(Promise.resolve([obmSetting]));
            ObmService.checkValidService.resolves();
            return helper.request().post('/api/1.1/nodes/1234/obm')
                .send(outputNode)
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function(data) {
                    expect(_.last(data.body.obmSettings)).to.deep.equal(outputObmSetting);
                });
        });


        it('should return a 404 if the node was not found', function () {
            waterline.nodes.needByIdentifier.rejects(new Errors.NotFoundError('Not Found'));

            return helper.request().post('/api/1.1/nodes/1234/obm')
                .send(obmSetting)
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });

    describe('POST /nodes/:identifier/obm/identify', function () {
        var obmMock = [{
            config: {},
            id: '574dcd5794ab6e2506fd107a',
            node: '1234abcd1234abcd1234abcd',
            service: 'ipmi-obm-service'
        }];

        it('should enable OBM identify on a node', function () {
            waterline.obms.findByNode.returns(Promise.resolve([obmMock]));
            nodesApiService.postNodeObmIdById.resolves(obmMock);

            return helper.request().post('/api/1.1/nodes/1234/obm/identify')
                .send({ value: true })
                .expect(200)
                .expect(function () {
                    expect(nodesApiService.postNodeObmIdById).to.have.been.calledOnce;

                });
        });

        it('should return a 404 if the node was not found', function () {
            waterline.obms.findByNode.returns(new Errors.NotFoundError('Not Found'));
            nodesApiService.postNodeObmIdById.rejects(new Errors.NotFoundError('Not Found'));

            return helper.request().post('/api/1.1/nodes/1234/obm/identify')
                .send({ value: true })
                .expect(404);
        });
    });

    describe('GET /nodes/:identifier/ssh', function () {
        var sshNode = _.cloneDeep(node);
        sshNode.sshSettings = {
            host: '1.2.3.4',
            user: 'myuser',
            password: 'mypass'
        };
        var serializedSshSettings = {
            host: '1.2.3.4',
            user: 'myuser',
            password: 'REDACTED'
        };

        it('should return a list of the node\'s ssh settings', function () {
            waterline.nodes.needByIdentifier.resolves(sshNode);

            return helper.request().get('/api/1.1/nodes/1234/ssh')
                .expect('Content-Type', /^application\/json/)
                .expect(200, serializedSshSettings);
        });

        it('should return a 404 if the node was not found', function () {
            waterline.nodes.needByIdentifier.rejects(new Errors.NotFoundError('Not Found'));

            return helper.request().get('/api/1.1/nodes/1234/ssh')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });

        it('should return a 404 if the node has no ssh settings', function () {
            waterline.nodes.needByIdentifier.resolves({ id: node.id });

            return helper.request().get('/api/1.1/nodes/1234/ssh')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });

    describe('POST /nodes/:identifier/ssh', function () {
        var sshNode = _.cloneDeep(nodeModelData);
        sshNode.sshSettings = {
            host: '1.2.3.4',
            user: 'myuser',
            password: 'mypass'
        };
        var updatedSshSettings = {
            'host': '5.5.5.5',
            'user': 'myuser2',
            'password': 'mypassword2'
        };
        var serializedUpdatedSshSettings = {
            'host': '5.5.5.5',
            'user': 'myuser2',
            'password': 'REDACTED'
        };

        it('should replace existing settings with a new set of ssh settings', function () {
            var updated = _.cloneDeep(nodeModelData);
            updated.sshSettings = updatedSshSettings;
            waterline.nodes.needByIdentifier.resolves(nodeModelData);
            waterline.nodes.updateByIdentifier.resolves(updated);
            return helper.request().post('/api/1.1/nodes/1234/ssh')
                .send(updatedSshSettings)
                .expect('Content-Type', /^application\/json/)
                .expect(201)
                .expect(function (data) {
                    expect(data.body.sshSettings).to.deep.equal(serializedUpdatedSshSettings);
                    expect(waterline.nodes.updateByIdentifier).to.have.been.calledOnce;
                    expect(waterline.nodes.updateByIdentifier).to.have.been.calledWith(node.id);
                    expect(waterline.nodes.updateByIdentifier.firstCall.args[1].sshSettings.host)
                        .to.equal(updatedSshSettings.host);
                });
        });

        it('should add a new set of ssh settings if none exist', function () {
            waterline.nodes.needByIdentifier.resolves({ id: nodeModelData.id });
            var updated = _.cloneDeep(nodeModelData);
            updated.sshSettings = updatedSshSettings;
            waterline.nodes.updateByIdentifier.resolves(updated);
            return helper.request().post('/api/1.1/nodes/1234/ssh')
                .send(updatedSshSettings)
                .expect('Content-Type', /^application\/json/)
                .expect(201)
                .expect(function (data) {
                    expect(data.body.sshSettings).to.deep.equal(serializedUpdatedSshSettings);
                    expect(waterline.nodes.updateByIdentifier).to.have.been.calledOnce;
                    expect(waterline.nodes.updateByIdentifier)
                                          .to.have.been.calledWith(nodeModelData.id);
                    expect(waterline.nodes.updateByIdentifier.firstCall.args[1].sshSettings.host)
                        .to.equal(updatedSshSettings.host);
                });
        });

        it('should not add a new unsupported ssh settings', function () {
            waterline.nodes.needByIdentifier.resolves(nodeModelData);
            var invalidSetting = {
                'host': '5.5.5.5'
            };

            waterline.nodes.needByIdentifier.resolves(nodeModelData);

            return helper.request().post('/api/1.1/nodes/1234/ssh')
                .send(invalidSetting)
                .expect('Content-Type', /^application\/json/)
                .expect(400)
                .expect(function () {
                    expect(waterline.nodes.updateByIdentifier).to.not.have.been.called;
                });
        });

        it('should return a 404 if the node was not found', function () {
            waterline.nodes.needByIdentifier.rejects(new Errors.NotFoundError('Not Found'));

            return helper.request().post('/api/1.1/nodes/1234/ssh')
                .send(updatedSshSettings)
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });

    describe('GET /nodes/:identifier/catalogs', function() {
        it('should get a list of catalogs', function () {
            var node = {
                id: '123',
                catalogs: [
                    {
                        node: '123',
                        source: 'dummysource',
                        data: {
                            foo: 'bar'
                        }
                    }
                ]
            };

            waterline.nodes.needByIdentifier.resolves(node);
            waterline.catalogs.find.resolves(node.catalogs);

            return helper.request().get('/api/1.1/nodes/123/catalogs')
                .expect('Content-Type', /^application\/json/)
                .expect(200, node.catalogs);
        });

        it('should return a 404 if the node was not found', function () {
            waterline.nodes.needByIdentifier.rejects(new Errors.NotFoundError('Not Found'));

            return helper.request().get('/api/1.1/nodes/123/catalogs')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });

    describe('GET /nodes/:identifier/catalogs/:source', function() {
        it('should return a single catalog', function () {
            waterline.nodes.needByIdentifier.resolves(Promise.resolve({

                id: '123',
                name: '123'
            }));
            waterline.catalogs.findLatestCatalogOfSource.resolves(
                {
                    node: '123',
                    source: 'dummysource',
                    data: {
                        foo: 'bar'
                    }
                }
            );

            return helper.request().get('/api/1.1/nodes/123/catalogs/dummysource')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.be.an("Object").with.property('source', 'dummysource');
                    expect(res.body).to.be.an("Object").with.property('node', '123');
                });
        });

        it('should return a 404 if an empty list is returned', function () {
            waterline.nodes.needByIdentifier.resolves({
                id: '123',
                name: '123'
            });

            waterline.catalogs.findLatestCatalogOfSource.resolves();

            return helper.request().get('/api/1.1/nodes/123/catalogs/dummysource')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });

        it("should return a 404 if the node was not found", function () {

            waterline.nodes.needByIdentifier.rejects(new Errors.NotFoundError('Not Found'));

            return helper.request().get('/api/1.1/nodes/123/catalogs/dummysource')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });

        it("should return a 404 if finding the node fails", function () {
            waterline.nodes.needByIdentifier.rejects(new Errors.NotFoundError('Not Found'));

            return helper.request().get('/api/1.1/nodes/123/catalogs/dummysource')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });

    describe('GET /nodes/:identifier/pollers', function() {
        it('should get a list of pollers', function () {
            var node = {
                id: '123'
            };
            var poller = {
                id: '4532',
                name: 'Pollers.IPMI',
                config: {}
            };
            waterline.nodes.needByIdentifier.resolves(node);
            waterline.workitems.findPollers.resolves([poller]);

            return helper.request().get('/api/1.1/nodes/123/pollers')
                .expect('Content-Type', /^application\/json/)
                .expect(200, [poller])
                .expect(function () {
                    expect(waterline.workitems.findPollers).to.have.been.calledOnce;
                    expect(waterline.workitems.findPollers.firstCall.args[0])
                        .to.have.property('node').that.equals('123');
                });
        });

        it('should return a 404 if the node was not found', function () {
            waterline.nodes.needByIdentifier.rejects(new Errors.NotFoundError('Not Found'));

            return helper.request().get('/api/1.1/nodes/123/pollers')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });

    describe('POST /nodes/:macaddress/dhcp/whitelist', function () {
        it('should add a MAC to an empty DHCP whitelist', function () {
            configuration.get.returns(undefined);

            return helper.request().post('/api/1.1/nodes/00:11:22:33:44:55/dhcp/whitelist')
                .expect(201)
                .expect(function () {
                    expect(configuration.get).to.have.been.calledWith('whitelist');
                    expect(configuration.set).to.have.been.calledOnce
                        .and.to.have.deep.property('firstCall.args')
                        .that.deep.equals(['whitelist', ['00-11-22-33-44-55']]);
                });
        });

        it('should append a MAC to an existing DHCP whitelist', function () {
            var configuration = helper.injector.get('Services.Configuration');
            configuration.get.returns(['00-00-00-00-00-00']);

            return helper.request().post('/api/1.1/nodes/00:11:22:33:44:ab/dhcp/whitelist')
                .expect(201)
                .expect(function () {
                    expect(configuration.get).to.have.been.calledWith('whitelist');
                    expect(configuration.set).to.have.been.calledOnce
                        .and.to.have.deep.property('firstCall.args')
                        .that.deep.equals(['whitelist',
                        ['00-00-00-00-00-00', '00-11-22-33-44-ab']]);
                });
        });
    });

    describe('DELETE /nodes/:macaddress/dhcp/whitelist', function () {
        it('should remove a MAC from the DHCP whitelist', function () {
            configuration.get.returns(['00-11-22-33-44-ab']);

            return helper.request().delete('/api/1.1/nodes/00:11:22:33:44:ab/dhcp/whitelist')
                .expect(204)
                .expect(function () {
                    expect(configuration.get).to.have.been.calledWith('whitelist');
                    expect(configuration.set).to.have.been.calledOnce
                        .and.to.have.deep.property('firstCall.args')
                        .that.deep.equals(['whitelist', []]);
                    expect(configuration.get('whitelist'))
                        .to.deep.equal([]);
                });
        });

        it('should do nothing if the DHCP whitelist is empty', function () {
            configuration.get.returns([]);

            return helper.request().delete('/api/1.1/nodes/00:11:22:33:44:55/dhcp/whitelist')
                .expect(204)
                .expect(function () {
                    expect(configuration.get).to.have.been.calledWith('whitelist');
                    expect(configuration.set).to.not.have.been.called;
                });
        });

        it('should do nothing if the DHCP whitelist is undefined', function () {
            configuration.get.returns(undefined);

            return helper.request().delete('/api/1.1/nodes/00:11:22:33:44:55/dhcp/whitelist')
                .expect(204)
                .expect(function () {
                    expect(configuration.get).to.have.been.calledWith('whitelist');
                    expect(configuration.set).to.not.have.been.called;
                });
        });
    });

    describe('GET /nodes/:identifier/workflows', function() {
        it('should get a list of workflows', function () {
            var node = {
                id: '123',
                workflows: [
                    {
                        name: 'TestGraph.Dummy'
                    }
                ]
            };

            waterline.nodes.needByIdentifier.resolves(node);
            waterline.graphobjects.find.resolves(node.workflows);

            return helper.request().get('/api/1.1/nodes/123/workflows')
                .expect('Content-Type', /^application\/json/)
                .expect(200, node.workflows);
        });

        it('should return a 404 if the node was not found', function () {
            waterline.nodes.needByIdentifier.rejects(new Errors.NotFoundError('Not Found'));

            return helper.request().get('/api/1.1/nodes/123/workflows')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });

    describe('POST /nodes/:identifier/workflows', function() {
        var graph = {
            instanceId: 'graphid'
        };

        beforeEach(function() {
            sinon.stub(nodesApiService, 'setNodeWorkflow');
        });

        afterEach(function() {
            nodesApiService.setNodeWorkflow.restore();
        });

        it('should create a workflow via the querystring', function () {
            nodesApiService.setNodeWorkflow.resolves(graph);

            return helper.request().post('/api/1.1/nodes/123/workflows')
                .send({ name: 'TestGraph.Dummy', domain: 'test' })
                .expect('Content-Type', /^application\/json/)
                .expect(201)
                .expect(function () {
                    expect(nodesApiService.setNodeWorkflow).to.have.been.calledOnce;
                    expect(nodesApiService.setNodeWorkflow).to.have.been.calledWith(
                        {
                            name: 'TestGraph.Dummy',
                            domain: 'test'
                        },
                        '123'
                    );
                });
        });

        it('should create a workflow with options via the querystring', function () {
            nodesApiService.setNodeWorkflow.resolves(graph);

            return helper.request().post('/api/1.1/nodes/123/workflows')
                .send({ name: 'TestGraph.Dummy', options: { test: 'foo' }, domain: 'test' })
                .expect('Content-Type', /^application\/json/)
                .expect(201)
                .expect(function () {
                    expect(nodesApiService.setNodeWorkflow).to.have.been.calledOnce;
                    expect(nodesApiService.setNodeWorkflow).to.have.been.calledWith(
                        {
                            name: 'TestGraph.Dummy',
                            domain: 'test',
                            options: { test: 'foo' }
                        },
                        '123'
                    );
                });
        });

        it('should create a workflow via the request body', function () {
            nodesApiService.setNodeWorkflow.resolves(graph);

            return helper.request().post('/api/1.1/nodes/123/workflows')
                .send({ name: 'TestGraph.Dummy', domain: 'test' })
                .expect('Content-Type', /^application\/json/)
                .expect(201)
                .expect(function () {
                    expect(nodesApiService.setNodeWorkflow).to.have.been.calledOnce;
                    expect(nodesApiService.setNodeWorkflow).to.have.been.calledWith(
                        {
                            name: 'TestGraph.Dummy',
                            domain: 'test'
                        },
                        '123'
                    );
                });
        });

        it('should create a workflow with options via the request body', function () {
            nodesApiService.setNodeWorkflow.resolves(graph);

            return helper.request().post('/api/1.1/nodes/123/workflows')
                .send({ name: 'TestGraph.Dummy', options: { test: true }, domain: 'test' })
                .expect('Content-Type', /^application\/json/)
                .expect(201)
                .expect(function () {
                    expect(nodesApiService.setNodeWorkflow).to.have.been.calledOnce;
                    expect(nodesApiService.setNodeWorkflow).to.have.been.calledWith(
                        {
                            name: 'TestGraph.Dummy',
                            domain: 'test',
                            options: { test: true }
                        },
                        '123'
                    );
                });
        });

        it('should return a 404 if the node was not found', function () {
            nodesApiService.setNodeWorkflow.rejects(new Errors.NotFoundError('Not Found'));

            return helper.request().post('/api/1.1/nodes/123/workflows')
                .send({})
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });

        it('should return a 400 on a bad request', function () {
            nodesApiService.setNodeWorkflow.rejects(new Errors.BadRequestError());

            return helper.request().post('/api/1.1/nodes/123/workflows')
                .send({})
                .expect(400);
        });
    });

    describe('GET /nodes/:identifier/workflows/active', function() {
        beforeEach(function() {
            sinon.stub(nodesApiService, 'getActiveNodeWorkflowById');
        });

        afterEach(function() {
            nodesApiService.getActiveNodeWorkflowById.restore();
        });

        it('should get the currently active workflow', function () {
            var graph = {
                instanceId: '0987'
            };
            nodesApiService.getActiveNodeWorkflowById.resolves(graph);

            return helper.request().get('/api/1.1/nodes/123/workflows/active')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function () {
                    expect(nodesApiService.getActiveNodeWorkflowById).to.have.been.calledOnce;
                    expect(nodesApiService.getActiveNodeWorkflowById)
                        .to.have.been.calledWith('123');
                });
        });

        it('should return a 404', function () {
            nodesApiService.getActiveNodeWorkflowById
                .rejects(new Errors.NotFoundError('Not Found'));

            return helper.request().get('/api/1.1/nodes/123/workflows/active')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });

    describe('DELETE /nodes/:identifier/workflows/active', function() {
        beforeEach(function() {
            sinon.stub(nodesApiService, 'delActiveWorkflowById');
        });

        afterEach(function() {
            if (nodesApiService.delActiveWorkflowById.restore) {
                nodesApiService.delActiveWorkflowById.restore();
            }
        });

        it('should delete the currently active workflow', function () {
            nodesApiService.delActiveWorkflowById.resolves();

            return helper.request().delete('/api/1.1/nodes/123/workflows/active')
                .expect(204)
                .expect(function () {
                    expect(nodesApiService.delActiveWorkflowById).to.have.been.calledOnce;
                    expect(nodesApiService.delActiveWorkflowById).to.have.been.calledWith('123');
                });
        });

        it('should return a 404 if the node was not found', function () {
            nodesApiService.delActiveWorkflowById.restore();
            waterline.nodes.needByIdentifier.rejects(new Errors.NotFoundError('Not Found'));

            return helper.request().delete('/api/1.1/nodes/123/workflows/active')
                .expect(404);
        });
    });
    describe('Tag support', function() {
        before(function() {
            sinon.stub(nodesApiService, 'getTagsById').resolves([]);
            sinon.stub(nodesApiService, 'addTagsById').resolves([]);
            sinon.stub(nodesApiService, 'removeTagsById').resolves([]);
        });

        after(function() {
            nodesApiService.getTagsById.restore();
            nodesApiService.addTagsById.restore();
            nodesApiService.removeTagsById.restore();
        });

        it('should call getTagsById', function() {
            return helper.request().get('/api/1.1/nodes/123/tags')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function() {
                    expect(nodesApiService.getTagsById).to.have.been.calledWith('123');
                });
        });

        it('should call addTagsById', function() {
            return helper.request().patch('/api/1.1/nodes/123/tags')
                .send({ tags: ['tag', 'name']})
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function() {
                    expect(nodesApiService.addTagsById).to.have.been
                        .calledWith('123', ['tag', 'name']);
                });
        });

        it('should call removeTagsById', function() {
            return helper.request().delete('/api/1.1/nodes/123/tags/name')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function() {
                    expect(nodesApiService.removeTagsById).to.have.been.calledWith('123', 'name');
                });
        });

    });


});
