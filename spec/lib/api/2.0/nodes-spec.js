// Copyright 2015-2016, EMC, Inc.

'use strict';

describe('2.0 Http.Api.Nodes', function () {
    var configuration;
    var waterline;
    var ObmService;
    var nodeApiService;
    var lookupService;
    var Promise;
    var Constants;
    var Errors;
    var nodesApi;

    before('start HTTP server', function () {
        this.timeout(10000);
        return helper.startServer([
        ]).then(function () {
            configuration = helper.injector.get('Services.Configuration');
            lookupService = helper.injector.get('Services.Lookup');
            lookupService.ipAddressToMacAddress = sinon.stub().resolves();
            lookupService.ipAddressToNodeId = sinon.stub().resolves();
            sinon.stub(configuration);

            waterline = helper.injector.get('Services.Waterline');
            sinon.stub(waterline.nodes);
            sinon.stub(waterline.ibms);
            sinon.stub(waterline.catalogs);
            sinon.stub(waterline.workitems);
            sinon.stub(waterline.graphobjects);

            ObmService = helper.injector.get('Task.Services.OBM');
            sinon.stub(ObmService.prototype, 'identifyOn');
            sinon.stub(ObmService.prototype, 'identifyOff');
            nodeApiService = helper.injector.get('Http.Services.Api.Nodes');
            sinon.stub(nodeApiService, "getAllNodes");
            sinon.stub(nodeApiService, "getNodeById");

            Promise = helper.injector.get('Promise');
            Constants = helper.injector.get('Constants');
            Errors = helper.injector.get('Errors');
            nodesApi = helper.injector.get('Http.Services.Api.Nodes');

        });
    });

    afterEach('reset stubs', function () {
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
        //resetStubs(workflowApiService);

        ObmService.prototype.identifyOn.reset();
        ObmService.prototype.identifyOff.reset();

        lookupService = helper.injector.get('Services.Lookup');
        lookupService.ipAddressToMacAddress = sinon.stub().resolves();
        lookupService.ipAddressToNodeId = sinon.stub().resolves();
    });

    after('stop HTTP server', function () {
        return helper.stopServer();
    });

    var obm =[{
        config: {},
        id: "574dcd5794ab6e2506fd107a",
        node: "1234abcd1234abcd1234abcd",
        service: "noop-obm-service"
    }];

    var ibm =[{
        config: {
            host: '1234',
            user: 'fake-password',
            password: 'fake-password'
        },
        id: "11111111111111111111111111",
        node: "12341234abcd123412341234",
        service: "ssh-ibm-service"
    }];

    var relations =[{
        relationType: "enclosedBy",
        targets: [ "5678abcd5678abcd5678abcd" ]
    }];

    var node = {
        autoDiscover: "false",
        catalogs:'/api/2.0/nodes/1234abcd1234abcd1234abcd/catalogs',
        id: '1234abcd1234abcd1234abcd',
        name: 'name',
        identifiers: [],
        tags: '/api/2.0/nodes/1234abcd1234abcd1234abcd/tags',
        pollers: '/api/2.0/nodes/1234abcd1234abcd1234abcd/pollers',
        relations:[{
            relationType: 'enclosedBy',
            info: null,
            targets: [ '5678abcd5678abcd5678abcd' ]
        }],
        obms: [{
            service: 'noop-obm-service',
            ref: '/api/2.0/obms/574dcd5794ab6e2506fd107a'
        }],
        ibms: [{
            service: 'ssh-ibm-service',
            ref: '/api/2.0/ibms/11111111111111111111111111'
        }],
        type: 'compute',
        workflows: '/api/2.0/nodes/1234abcd1234abcd1234abcd/workflows'
    };

    var postNode = {
        name: 'name',
        type: 'compute'
    };

    var rawNode = {
        autoDiscover: "false",
        id: '1234abcd1234abcd1234abcd',
        name: 'name',
        identifiers: [],
        relations: relations,
        obms: obm,
        ibms: ibm,
        type: 'compute'
    };

    describe('2.0 GET /nodes', function () {
        it('should return a list of nodes', function () {
            waterline.nodes.find.resolves([rawNode]);
            waterline.nodes.count.resolves(1);
            nodeApiService.getAllNodes.resolves(rawNode);

            return helper.request().get('/api/2.0/nodes')
                .expect('Content-Type', /^application\/json/)
                .expect(200, node);
        });
    });

    describe('2.0 POST /nodes', function () {
        beforeEach(function() {
            sinon.stub(nodeApiService, 'postNode');
        });

        afterEach(function() {
            nodeApiService.postNode.restore();
        });

        it('should create a node', function () {
            nodeApiService.postNode.resolves(node);

            return helper.request().post('/api/2.0/nodes')
                .send(postNode)
                .expect('Content-Type', /^application\/json/)
                .expect(201, node)
                .expect(function () {
                    expect(nodeApiService.postNode).to.have.been.calledOnce;
                    expect(nodeApiService.postNode.firstCall.args[0])
                        .to.have.property('name').that.equals(node.name);
                });
        });
    });

    describe('GET /nodes/:id', function () {
        it('should return a single node', function () {
            nodeApiService.getNodeById.withArgs('1234abcd1234abcd1234abcd').resolves(rawNode);

            return helper.request().get('/api/2.0/nodes/1234abcd1234abcd1234abcd')
                .expect('Content-Type', /^application\/json/)
                .expect(200, node)
                .expect(function () {
                    expect(nodeApiService.getNodeById).to.have.been
                        .calledWith('1234abcd1234abcd1234abcd');
                    expect(nodeApiService.getNodeById).to.have.been.called;
                });
        });

        it('should return an empty array when an invalid nodeId is passed', function () {
            nodeApiService.getNodeById.withArgs('1234').resolves([]);

            return helper.request().get('/api/2.0/nodes/1234')
                .expect(200, [])
                .expect(function (){
                    expect(nodeApiService.getNodeById).to.have.been.called;
                });
        });
    });

    describe('PATCH /nodes/:identifier', function () {
        it('should update a node', function () {
            waterline.nodes.needByIdentifier.resolves(node);
            waterline.nodes.updateByIdentifier.resolves(node);
            return helper.request().patch('/api/2.0/nodes/1234')
                .send(rawNode)
                .expect('Content-Type', /^application\/json/)
                .expect(200, node)
                .expect(function () {
                    expect(waterline.nodes.updateByIdentifier).to.have.been.calledOnce;
                    expect(waterline.nodes.updateByIdentifier).to.have.been.calledWith('1234');
                    expect(
                        waterline.nodes.updateByIdentifier.firstCall.args[1]
                    ).to.have.property('id').and.equal(node.id);
                });
        });

        it('should return a 404 if the node was not found', function () {
            waterline.nodes.needByIdentifier.rejects(new Errors.NotFoundError('Not Found'));

            return helper.request().patch('/api/2.0/nodes/1234')
                .send(rawNode)
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });

    });

    describe('DELETE /nodes/:identifier', function () {
        beforeEach(function() {
            sinon.stub(nodeApiService, 'removeNode');
        });

        afterEach(function() {
            nodeApiService.removeNode.restore();
        });

        it('should delete a node', function () {
            var nodeApiService = helper.injector.get('Http.Services.Api.Nodes');

            waterline.nodes.needByIdentifier.resolves(node);
            nodeApiService.removeNode.resolves(node);

            return helper.request().delete('/api/2.0/nodes/1234')
                .expect(204)
                .expect(function () {
                    expect(nodeApiService.removeNode).to.have.been.calledOnce;
                });
        });

        it('should return a 404 if the node was not found', function () {
            waterline.nodes.needByIdentifier.rejects(new Errors.NotFoundError('Not Found'));

            return helper.request().delete('/api/2.0/nodes/1234')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });

    describe('GET /nodes/:identifier/relations', function() {

        it('should return a list of the node\'s relations', function() {
            waterline.nodes.needByIdentifier.resolves(node);
            return helper.request().get('/api/2.0/nodes/1234/relations')
                .expect('Content-Type', /^application\/json/)
                .expect(200, node.relations);
        });

        it('should return a 404 if the node was not found', function() {
            waterline.nodes.needByIdentifier.rejects(new Errors.NotFoundError('Not Found'));

            return helper.request().get('/api/2.0/nodes/1234/relations')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });

    describe('PUT /nodes/:identifier/relations', function() {
        var relationUpdate;
        beforeEach(function() {
            sinon.stub(nodeApiService, 'editNodeRelations');
            relationUpdate = {
                containedBy: ['rackNodeId']
            };
        });

        afterEach(function() {
            nodeApiService.editNodeRelations.restore();
        });

        it('should add to and update a node\'s relations', function() {
            var updatedRackNode = _.cloneDeep(rawNode);
            updatedRackNode.type = 'rack';
            updatedRackNode.id = 'rackNodeId';
            updatedRackNode.relations = [{relationType: 'contains', targets: rawNode.id}];

            var updatedComputeNode = _.cloneDeep(rawNode);
            updatedComputeNode.relations = relations.concat({
                relationType: 'containedBy', targets: ['rackNodeId']
            });

            nodeApiService.editNodeRelations.resolves([
                updatedComputeNode, updatedRackNode
            ]);
            return helper.request().put('/api/2.0/nodes/1234/relations')
                .send(relationUpdate)
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function(data) {
                    expect(data.body[0].relations).to.deep.equal(updatedComputeNode.relations);
                    expect(data.body[1].relations).to.deep.equal(updatedRackNode.relations);
                    expect(nodeApiService.editNodeRelations).to.be.calledWithExactly(
                        '1234',relationUpdate, nodeApiService._addRelation
                    );
                });

        });

        it('should return a 404 if the node is not found', function() {
            nodeApiService.editNodeRelations.rejects(new Errors.NotFoundError("Not Found"));
            return helper.request().put('/api/2.0/nodes/1234/relations')
                .send(relationUpdate)
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });

    describe('DELETE /nodes/:identifier/relations', function() {
        var relationDeletion;
        beforeEach(function() {
            sinon.stub(nodeApiService, 'editNodeRelations');
            relationDeletion = {
                containedBy: ['rackNodeId']
            };
        });

        afterEach(function() {
            nodeApiService.editNodeRelations.restore();
        });

        it('should delete the given relations from a node', function() {
            var updatedRackNode = _.cloneDeep(rawNode);

            var updatedComputeNode = _.cloneDeep(rawNode);
            nodeApiService.editNodeRelations.resolves([updatedComputeNode, updatedRackNode]);
            return helper.request().delete('/api/2.0/nodes/1234/relations')
                .send(relationDeletion)
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function(data) {
                    expect(data.body[0].relations).to.deep.equal(updatedComputeNode.relations);
                    expect(data.body[1].relations).to.deep.equal(updatedRackNode.relations);
                    expect(nodeApiService.editNodeRelations).to.be.calledWithExactly(
                        '1234', relationDeletion, nodeApiService._removeRelation
                    );
                });
        });

        it('should return a 404 if the node is not found', function() {
            nodeApiService.editNodeRelations.rejects(new Errors.NotFoundError("Not Found"));
            return helper.request().delete('/api/2.0/nodes/1234/relations')
                .send(relationDeletion)
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });

    describe('GET /nodes/:identifier/ssh', function () {
        var sshNode = _.cloneDeep(node);
        sshNode.ibms = {
            service: "ssh-ibm-service",
            config:{
            host: '1.2.3.4',
            user: 'myuser',
            password: 'mypass'
            }
        };

        it('should return a list of the node\'s ssh settings', function () {
            waterline.nodes.getNodeById.resolves(sshNode);
            waterline.ibms.findAllByNode.resolves(ibm);

            return helper.request().get('/api/2.0/nodes/1234/ssh')
                .expect('Content-Type', /^application\/json/)
                .expect(200, ibm);
        });
        
        it('should return a 404 if the node was not found', function () {
            waterline.nodes.getNodeById.rejects(new Errors.NotFoundError('Not Found'));

            return helper.request().get('/api/2.0/nodes/1234/ssh')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });

        it('should return a 404 if the node has no ssh settings', function () {
            waterline.nodes.getNodeById.resolves({ id: node.id });
            waterline.ibms.findAllByNode.rejects(new Errors.NotFoundError('Not Found'));

            return helper.request().get('/api/2.0/nodes/1234/ssh')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });

    });

    describe('POST /nodes/:identifier/ssh', function () {
        var sshNode = _.cloneDeep(node);
        sshNode.ibms = [{
            service: "ssh-ibm-service",
            ref: '/api/2.0/ibms/1234'
        }];

        var sendSsh = {
            service: "ssh-ibm-service",
            config:{
                host: "5.5.5.5",
                user: "myuser2",
                password: 'mypass'
            }
        };

        var tempNode = 
        {
            autoDiscover: "false",
            catalogs:'/api/2.0/nodes/1234abcd1234abcd1234abcd/catalogs',
            id: '1234foo',
            name: 'name',
            identifiers: []
        };
        
        it('should replace existing settings with a new set of ssh settings', function () {
            waterline.nodes.getNodeById.resolves(node);
            waterline.ibms.upsertByNode.resolves(sshNode);
            return helper.request().post('/api/2.0/nodes/1234abcd1234abcd1234abcd/ssh')
                .send(sendSsh)
                .expect('Content-Type', /^application\/json/)
                .expect(201)
                .expect(function (data) {
                    expect(data.body.ibms).to.deep.equal(sshNode.ibms);
                    expect(waterline.nodes.getNodeById).to.have.been.calledOnce;
                });
        });

        it('should add a new set of ssh settings if none exist', function () {
            waterline.nodes.getNodeById.resolves(tempNode);
            waterline.ibms.upsertByNode.resolves(sendSsh);
            return helper.request().post('/api/2.0/nodes/1234foo/ssh')
                .send(sendSsh)
                .expect('Content-Type', /^application\/json/)
                .expect(201)
                .expect(function (data) {
                    expect(data.body).to.deep.equal(sendSsh);
                    expect(waterline.nodes.getNodeById).to.have.been.calledOnce;
                });
        });

        it('should not add a new unsupported ssh settings', function () {
            waterline.nodes.getNodeById.resolves(node);
            var invalidSetting = {
                'host': '5.5.5.5'
            };

            waterline.nodes.getNodeById.resolves(node);

            return helper.request().post('/api/2.0/nodes/1234/ssh')
                .send(invalidSetting)
                .expect('Content-Type', /^application\/json/)
                .expect(400);
        });

        it('should return a 404 if the node was not found', function () {
            waterline.nodes.getNodeById.rejects(new Errors.NotFoundError('Not Found'));

            return helper.request().post('/api/2.0/nodes/1234/ssh')
                .send(sendSsh)
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });

    describe('GET /nodes/:identifier/catalogs', function() {
        it('should get a list of catalogs', function () {
            var node = {

                id: '1234',
                catalogs: [
                    {   id: '123',
                        node: '1234',
                        source: 'dummysource',
                        data: {
                            foo: 'bar'
                        }
                    }
                ]
            };

            waterline.nodes.needByIdentifier.resolves(node);
            waterline.catalogs.find.resolves(node.catalogs);

            return helper.request().get('/api/2.0/nodes/1234/catalogs')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function(res){
                    expect(res.body[0])
                        .to.have.property('node').that.equals('/api/2.0/nodes/1234');
                    expect(res.body[0])
                        .to.have.property('id').that.equals('123');
                    expect(res.body[0])
                        .to.have.property('source').that.equals('dummysource');
                    expect(res.body[0].data)
                        .to.deep.equal( {foo:'bar'} );
                });
        });

        it('should return a 404 if the node was not found', function () {
            waterline.nodes.needByIdentifier.rejects(new Errors.NotFoundError('Not Found'));

            return helper.request().get('/api/2.0/nodes/123/catalogs')
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

            return helper.request().get('/api/2.0/nodes/123/catalogs/dummysource')
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

            return helper.request().get('/api/2.0/nodes/123/catalogs/dummysource')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });

        it("should return a 404 if the node was not found", function () {

            waterline.nodes.needByIdentifier.rejects(new Errors.NotFoundError('Not Found'));

            return helper.request().get('/api/2.0/nodes/123/catalogs/dummysource')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });

        it("should return a 404 if finding the node fails", function () {
            waterline.nodes.needByIdentifier.rejects(new Errors.NotFoundError('Not Found'));

            return helper.request().get('/api/2.0/nodes/123/catalogs/dummysource')
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

            return helper.request().get('/api/2.0/nodes/123/pollers')
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

            return helper.request().get('/api/2.0/nodes/123/pollers')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });

    describe('GET /nodes/:identifier/workflows', function() {
        it('should get a list of workflows', function () {
            var node = {
                id: '123',
                workflows: [{
                        name: 'TestGraph.Dummy'
                    }]
            };

            waterline.graphobjects.find.resolves(node.workflows);

            return helper.request().get('/api/2.0/nodes/123/workflows')
                .expect('Content-Type', /^application\/json/)
                .expect(200, node.workflows);
        });

        it('should return an active workflow', function() {
            var node = {
                id: '123',
                workflows: [{
                    name: 'TestGraph.Dummy',
                    status: 'pending'
                }]
            };

            waterline.graphobjects.find.resolves(node.workflows);

            return helper.request().get('/api/2.0/nodes/123/workflows')
                .expect('Content-Type', /^application\/json/)
                .expect(200, node.workflows)
                .then(function(res){
                    expect(res.body[0]).to.have.property('status', 'pending');
		});
        });

        it('should return a 404 if the node was not found', function () {
            waterline.graphobjects.find.rejects(new Errors.NotFoundError('Not Found'));
            return helper.request().get('/api/2.0/nodes/123/workflows')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });

    describe('POST /nodes/:identifier/workflows', function() {
        var graph = {
            instanceId: 'graphid'
        };

        beforeEach(function() {
            sinon.stub(nodeApiService, 'setNodeWorkflow');
        });

        afterEach(function() {
            nodeApiService.setNodeWorkflow.restore();
        });

        it('should create a workflow via the querystring', function () {
            nodeApiService.setNodeWorkflow.resolves(graph);

            return helper.request()
                .post('/api/2.0/nodes/123/workflows?name=TestGraph.Dummy')
                .send({ domain: 'test' })
                .expect('Content-Type', /^application\/json/)
                .expect(201)
                .expect(function () {
                    expect(nodeApiService.setNodeWorkflow).to.have.been.calledOnce;
                    expect(nodeApiService.setNodeWorkflow).to.have.been.calledWith(
                        {
                            name: 'TestGraph.Dummy',
                            domain: 'test'
                        },
                        '123'
                    );
                });
        });

        it('should let the graph name in querystring take precedance over body', function () {
            nodeApiService.setNodeWorkflow.resolves(graph);

            return helper.request().post('/api/2.0/nodes/123/workflows?name=Graph.foo')
                .send({ name: 'Graph.bar', options: { test: 'foo' }, domain: 'test' })
                .expect('Content-Type', /^application\/json/)
                .expect(201)
                .expect(function () {
                    expect(nodeApiService.setNodeWorkflow).to.have.been.calledOnce;
                    expect(nodeApiService.setNodeWorkflow).to.have.been.calledWith(
                        {
                            name: 'Graph.foo',
                            domain: 'test',
                            options: { test: 'foo' }
                        },
                        '123'
                    );
                });
        });

        it('should create a workflow with options via the querystring', function () {
            nodeApiService.setNodeWorkflow.resolves(graph);

            return helper.request().post('/api/2.0/nodes/123/workflows?name=TestGraph.Dummy')
                .send({ options: { test: 'foo' }, domain: 'test' })
                .expect('Content-Type', /^application\/json/)
                .expect(201)
                .expect(function () {
                    expect(nodeApiService.setNodeWorkflow).to.have.been.calledOnce;
                    expect(nodeApiService.setNodeWorkflow).to.have.been.calledWith(
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
            nodeApiService.setNodeWorkflow.resolves(graph);

            return helper.request().post('/api/2.0/nodes/123/workflows')
                .send({ name: 'TestGraph.Dummy', domain: 'test' })
                .expect('Content-Type', /^application\/json/)
                .expect(201)
                .expect(function () {
                    expect(nodeApiService.setNodeWorkflow).to.have.been.calledOnce;
                    expect(nodeApiService.setNodeWorkflow).to.have.been.calledWith(
                        {
                            name: 'TestGraph.Dummy',
                            domain: 'test'
                        },
                        '123'
                    );
                });
        });

        it('should create a workflow with options via the request body', function () {
            nodeApiService.setNodeWorkflow.resolves(graph);

            return helper.request().post('/api/2.0/nodes/123/workflows')
                .send({ name: 'TestGraph.Dummy', options: { test: true }, domain: 'test' })
                .expect('Content-Type', /^application\/json/)
                .expect(201)
                .expect(function () {
                    expect(nodeApiService.setNodeWorkflow).to.have.been.calledOnce;
                    expect(nodeApiService.setNodeWorkflow).to.have.been.calledWith(
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
            nodeApiService.setNodeWorkflow.rejects(new Errors.NotFoundError('Not Found'));

            return helper.request().post('/api/2.0/nodes/123/workflows')
                .send({})
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });

        it('should return a 400 on a bad request', function () {
            nodeApiService.setNodeWorkflow.rejects(new Errors.BadRequestError());

            return helper.request().post('/api/2.0/nodes/123/workflows')
                .send({})
                .expect(400);
        });
    });

    describe('DELETE /nodes/:identifier/workflows/action', function() {
        var graph = {id: '123'};
        var action = { command: 'cancel'};

        beforeEach(function() {
            sinon.stub(nodeApiService, 'delActiveWorkflowById');
        });

        afterEach(function() {
            if (nodeApiService.delActiveWorkflowById.restore) {
                nodeApiService.delActiveWorkflowById.restore();
            }
        });

        it('should delete the currently active workflow', function () {
            nodeApiService.delActiveWorkflowById.resolves(graph);

            return helper.request().put('/api/2.0/nodes/123/workflows/action')
                .set('Content-Type', 'application/json')
                .send(action)
                .expect(202)
                .expect(function () {
                    expect(nodeApiService.delActiveWorkflowById).to.have.been.calledOnce;
                    expect(nodeApiService.delActiveWorkflowById).to.have.been.calledWith('123');
                });
        });

        it('should return a 404 if no active workflow for node', function () {
            nodeApiService.delActiveWorkflowById.rejects(new Errors.NotFoundError('Not Found'));
            return helper.request().put('/api/2.0/nodes/123/workflows/action')
                .set('Content-Type', 'application/json')
                .send(action)
                .expect(404);
        });
    });

    describe('Tag support', function() {
        before(function() {
            sinon.stub(nodesApi, 'getTagsById').resolves([]);
            sinon.stub(nodesApi, 'addTagsById').resolves([]);
            sinon.stub(nodesApi, 'removeTagsById').resolves([]);
            sinon.stub(nodesApi, 'masterDelTagById')
                .resolves(['1234abcd1234abcd1234abcd', '5678efgh5678efgh5678efgh']);
        });

        after(function() {
            nodesApi.getTagsById.restore();
            nodesApi.addTagsById.restore();
            nodesApi.removeTagsById.restore();
            nodesApi.masterDelTagById.restore();
        });

        it('should call getTagsById', function() {
            return helper.request().get('/api/2.0/nodes/123/tags')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function() {
                    expect(nodesApi.getTagsById).to.have.been.calledWith('123');
                });
        });

        it('should call addTagsById', function() {
            return helper.request().patch('/api/2.0/nodes/123/tags')
                .send({ tags: ['tag', 'name']})
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function() {
                    expect(nodesApi.addTagsById).to.have.been.calledWith('123', ['tag', 'name']);
                });
        });

        it('should call removeTagsById', function() {
            return helper.request().delete('/api/2.0/nodes/123/tags/name')
                .expect(204)
                .expect(function() {
                    expect(nodesApi.removeTagsById).to.have.been.calledWith('123', 'name');
                });
        });

        it('should call masterDelTagById', function() {
            return helper.request().delete('/api/2.0/nodes/tags/name')
                .expect(204)
                .expect(function() {
                    expect(nodesApi.masterDelTagById).to.have.been.calledWith('name');
                });
        });
    });

    describe('OBM support', function() {

        var obm = {
            service: 'ipmi-obm-service',
            config: {
                host: '1.2.3.4',
                user: 'myuser',
                password: 'mypass'
            }
        };

        var obmRes = {
            id: "57c5e319c466ff9435d27fb3",
            node: "",
            service: "noop-obm-service",
            config: {}
        };

        after(function() {
            nodesApi.getObmsByNodeId.restore();
            nodesApi.putObmsByNodeId.restore();
        });

        it('should call getObmsByNodeId', function() {
            sinon.stub(nodesApi, 'getObmsByNodeId').resolves([obmRes]);

            return helper.request().get('/api/2.0/nodes/123/obm')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function(res) {
                    expect(nodesApi.getObmsByNodeId).to.have.been.calledWith('123');
                    expect(res.body[0].id).to.equal(obmRes.id);
                });
        });

        it('should call putObmsByNodeId', function() {
            sinon.stub(nodesApi, 'putObmsByNodeId').resolves([]);

            return helper.request().put('/api/2.0/nodes/123/obm')
                .send(obm)
                .expect('Content-Type', /^application\/json/)
                .expect(201)
                .expect(function() {
                    expect(nodesApi.putObmsByNodeId).to.have.been.calledWith('123',obm);
                });
        });
    });

});
