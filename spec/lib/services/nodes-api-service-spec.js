// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved.

"use strict";

describe("Http.Services.Api.Nodes", function () {
    var nodeApiService;
    var workflowApiService;
    var Errors;
    var waterline;
    var updateByIdentifier;
    var create;
    var getNodeById;
    var needByIdentifier;
    var findActiveGraphForTarget;
    var findAllByNode;
    var upsertByNode;
    var computeNode;
    var enclosureNode;
    var rackNode;
    var _;
    var eventsProtocol;
    var Promise;
    var findByNode;
    var upsertByNodeIbm;
    var removeListItemsByIdentifier;

    before("Http.Services.Api.Nodes before", function() {
        helper.setupInjector([
            onHttpContext.prerequisiteInjectables,
            helper.require("/lib/services/nodes-api-service"),
            helper.require("/lib/services/workflow-api-service"),
            helper.require("/lib/services/taskgraph-api-service"),
            dihelper.simpleWrapper({}, 'Task.Services.OBM'),
            dihelper.simpleWrapper({}, 'ipmi-obm-service')
        ]);
        nodeApiService = helper.injector.get("Http.Services.Api.Nodes");
        workflowApiService = helper.injector.get("Http.Services.Api.Workflows");
        Errors = helper.injector.get("Errors");
        waterline = helper.injector.get('Services.Waterline');
        _ = helper.injector.get('_');
        eventsProtocol = helper.injector.get('Protocol.Events');
        Promise = helper.injector.get('Promise');
        waterline.nodes = {
            create: function() {},
            getNodeById: function() {},
            needByIdentifier: function() {},
            updateByIdentifier: function() {},
            destroy: function() {},
            removeListItemsByIdentifier: function() {}     
        };
        waterline.catalogs = {
            destroy: function() {}
        };
        waterline.workitems = {
            destroy: function() {}
        };
        waterline.lookups = {
            update: function() {}
        };
        waterline.obms = {
            findAllByNode: function() {},
            upsertByNode: function() {}
        };
        waterline.ibms = {
            findByNode: function() {},
            upsertByNode: function() {}
        };
        this.sandbox = sinon.sandbox.create();
    });

    beforeEach("Http.Services.Api.Nodes beforeEach", function() {
        computeNode = {
            id: '1234abcd1234abcd1234abcd',
            type: 'compute',
            relations: [
                {
                    "relationType": "enclosedBy",
                    "targets": [
                        "1234abcd1234abcd1234abcf"
                    ]
                }
            ]
        };
        enclosureNode = {
            id: '1234abcd1234abcd1234abcf',
            type: 'enclosure',
            relations: [
                {
                    "relationType": "encloses",
                    "targets": [
                        "1234abcd1234abcd1234abcd",
                        "1234abcd1234abcd1234abce"
                    ]
                }
            ]
        };
        rackNode = {
            id: '1234abcd1234abcd1234abcc',
            type: 'rack',
            relations: []
        };

        create = this.sandbox.stub(waterline.nodes, 'create');
        getNodeById = this.sandbox.stub(waterline.nodes, 'getNodeById');
        needByIdentifier = this.sandbox.stub(waterline.nodes, 'needByIdentifier');
        updateByIdentifier = this.sandbox.stub(waterline.nodes, 'updateByIdentifier');
        removeListItemsByIdentifier = this.sandbox.stub(
                waterline.nodes, 'removeListItemsByIdentifier');
        findActiveGraphForTarget = this.sandbox.stub(
                workflowApiService, 'findActiveGraphForTarget');
        findAllByNode = this.sandbox.stub(waterline.obms, 'findAllByNode');
        upsertByNode = this.sandbox.stub(waterline.obms, 'upsertByNode');
        upsertByNodeIbm = this.sandbox.stub(waterline.ibms, 'upsertByNode');
        findByNode = this.sandbox.stub(waterline.ibms, 'findByNode');
        this.sandbox.stub(eventsProtocol, 'publishNodeEvent').resolves({});

    });

    afterEach("Http.Services.Api.Nodes afterEach", function() {
        this.sandbox.restore();
    });

    describe("postNode", function() {
        var postBody = {
            name: 'name',
            type: 'compute',
            obms: [
                {
                    service: 'ipmi-obm-service',
                    config: {
                        host: '1.2.3.4',
                        user: 'myuser',
                        password: 'mypass'
                    }
                },
                {
                    service: 'snmp-obm-service',
                    config: {
                        host: '1.2.3.4',
                        community: 'abcdef'
                    }
                }
            ]
        };

        var node = {
            id: '1234abcd1234abcd1234abcd',
            name: 'name',
            type: 'compute',
            obms: []
        };

        it('should create a node & obms', function () {
            waterline.nodes.create.resolves(node);
            return nodeApiService.postNode(postBody)
            .then(function() {
                expect(waterline.nodes.create).to.have.been.calledOnce;
                expect(
                    waterline.nodes.create.firstCall.args[0]
                ).to.deep.equal({ name: 'name', type: 'compute' });
                expect(waterline.obms.upsertByNode).to.have.been.calledTwice;
                expect(waterline.obms.upsertByNode)
                    .to.be.calledWith(node.id, postBody.obms[0]);
                expect(waterline.obms.upsertByNode)
                    .to.be.calledWith(node.id, postBody.obms[1]);
            });
        });

        it('should run discovery if the requested node is an autoDiscoverable switch', function() {
            var switchNode = {
                id: '1234abcd1234abcd1234abcd',
                name: 'name',
                ibms: [{
                    service: 'snmp-ibm-service',
                    config: {
                        host: '1.2.3.4',
                        community: 'community'
                    }
                }],
                autoDiscover: true,
                type: 'switch'
            };

            waterline.nodes.create.resolves(switchNode);
            waterline.ibms.upsertByNode.resolves({});
            waterline.ibms.findByNode.resolves(switchNode.ibms);
            this.sandbox.stub(workflowApiService, 'createAndRunGraph').resolves({});

            return nodeApiService.postNode(switchNode)
            .then(function() {
                expect(waterline.ibms.upsertByNode).to.have.been.calledOnce;
                expect(waterline.ibms.findByNode).to.have.been.calledOnce;
                expect(workflowApiService.createAndRunGraph).to.have.been.calledOnce;
                expect(workflowApiService.createAndRunGraph).to.have.been.calledWith(
                    {
                        name: 'Graph.Switch.Discovery',
                        options: { defaults: switchNode.ibms }
                    },
                    switchNode.id
                );
            });
        });

        it('should run discovery if the requested node is an autoDiscoverable mgmt server',
        function() {
            var mgmtNode = {
                id: '1234abcd1234abcd1234abce',
                name: 'mgmt server',
                obms: [
                    {
                        config: {
                            host: '1.2.3.4',
                            user: 'user',
                            password: 'password'
                        },
                        service: 'ipmi-obm-service'
                    }
                ],
                autoDiscover: true,
                type: 'mgmt'
            };
            var options = {
                defaults: {
                    graphOptions: {
                        target: mgmtNode.id
                    },
                    nodeId: mgmtNode.id
                }
            };

            waterline.nodes.create.resolves(mgmtNode);
            this.sandbox.stub(workflowApiService, 'createAndRunGraph').resolves({});

            return nodeApiService.postNode(mgmtNode)
            .then(function() {
                expect(waterline.obms.upsertByNode).to.be.calledOnce;
                expect(waterline.obms.upsertByNode)
                    .to.be.calledWith(mgmtNode.id, mgmtNode.obms[0]);
                expect(workflowApiService.createAndRunGraph).to.have.been.calledOnce;
                expect(workflowApiService.createAndRunGraph).to.have.been.calledWith(
                    {
                        name: 'Graph.MgmtSKU.Discovery',
                        options: options
                    }
                );
            });
        });

        it('should run discovery if the requested node is an autoDiscoverable PDU',
        function() {
            var pduNode = {
                id: '1234abcd1234abcd1234abcd',
                name: 'name',
                ibms: [{
                    service: 'snmp-ibm-service',
                    config: {
                        host: '1.2.3.4',
                        community: 'community'
                    }
                }],
                autoDiscover: true,
                type: 'pdu'
            };
            waterline.nodes.create.resolves(pduNode);
            waterline.ibms.upsertByNode.resolves({});
            waterline.ibms.findByNode.resolves(pduNode.ibms);
            this.sandbox.stub(workflowApiService, 'createAndRunGraph').resolves({});

            return nodeApiService.postNode(pduNode)
            .then(function() {
                expect(waterline.ibms.upsertByNode).to.have.been.calledOnce;
                expect(workflowApiService.createAndRunGraph).to.have.been.calledOnce;
                expect(workflowApiService.createAndRunGraph).to.have.been.calledWith(
                    {
                        name: 'Graph.PDU.Discovery',
                        options: { defaults: pduNode.ibms }
                    },
                    pduNode.id
                );
            });
        });

        it('should publish a node added event if the node is a rack', function() {
            var rackNode = {
                id: 'someNodeId',
                type: 'rack',
                name: 'rackNode'
            };
            waterline.nodes.create.resolves(rackNode);
            return nodeApiService.postNode(rackNode)
            .then(function() {
                expect(eventsProtocol.publishNodeEvent).to.be.calledWithExactly(
                    rackNode, 'added'
                );
            });
        });
    });

    describe('setNodeWorkflow/setNodeWorkflowById', function() {
        it('should create a workflow', function () {
            this.sandbox.stub(workflowApiService, 'createAndRunGraph').resolves();

            return nodeApiService.setNodeWorkflow(
                { name: 'TestGraph.Dummy', domain: 'test' },
                'testnodeid'
            )
            .then(function () {
                    expect(workflowApiService.createAndRunGraph).to.have.been.calledOnce;
                    expect(workflowApiService.createAndRunGraph).to.have.been.calledWith(
                        { name: 'TestGraph.Dummy', domain: 'test' },
                        'testnodeid'
                    );
                });
        });

        it('should create a workflow', function () {
            this.sandbox.stub(workflowApiService, 'createAndRunGraph').resolves();

            return nodeApiService.setNodeWorkflowById(
                { name: 'TestGraph.Dummy', domain: 'test' },
                'testnodeid'
            )
            .then(function () {
                    expect(workflowApiService.createAndRunGraph).to.have.been.calledOnce;
                    expect(workflowApiService.createAndRunGraph).to.have.been.calledWith(
                        { name: 'TestGraph.Dummy', domain: 'test' },
                        'testnodeid'
                    );
                });
        });
    });

    describe('getActiveNodeWorkflowById', function() {
        it('should get the currently active workflow', function () {
            var node = {
                id: '123'
            };
            var graph = {
                instanceId: '0987'
            };
            waterline.nodes.needByIdentifier.resolves(node);
            findActiveGraphForTarget.resolves(graph);

            return nodeApiService.getActiveNodeWorkflowById(node.id)
            .then(function() {
                expect(findActiveGraphForTarget).to.have.been.calledOnce;
                expect(findActiveGraphForTarget)
                    .to.have.been.calledWith(node.id);
            });
        });

        it('should throw a NotFoundError if the node has no active graph', function () {
            waterline.nodes.needByIdentifier.resolves({ id: 'testid' });
            findActiveGraphForTarget.resolves(null);
            return expect(nodeApiService.getActiveNodeWorkflowById('test')).to.become(null);
        });
    });

    describe('delActiveWorkflowById', function() {
        it('should delete the currently active workflow', function () {
            var node = {
                id: '123'
            };
            var graph = {
                instanceId: 'testgraphid'
            };
            waterline.nodes.needByIdentifier.resolves(node);
            findActiveGraphForTarget.resolves(graph);
            this.sandbox.stub(workflowApiService, 'cancelTaskGraph').resolves(graph.instanceId);

            return nodeApiService.delActiveWorkflowById('testnodeid')
            .then(function() {
                expect(findActiveGraphForTarget).to.have.been.calledOnce;
                expect(findActiveGraphForTarget)
                    .to.have.been.calledWith(node.id);
                expect(workflowApiService.cancelTaskGraph).to.have.been.calledOnce;
                expect(workflowApiService.cancelTaskGraph)
                    .to.have.been.calledWith(graph.instanceId);
            });
        });

        it('should throw a NotFoundError if there is no active workflow', function () {
            var node = {
                id: '123'
            };
            waterline.nodes.needByIdentifier.resolves(node);
            findActiveGraphForTarget.resolves(null);

            return expect(nodeApiService.delActiveWorkflowById('testnodeid'))
                .to.be.rejectedWith(Errors.NotFoundError);
        });

        it('should throw a NotFoundError if the workflow completes while processing the request',
                function () {
            var node = {
                id: '123'
            };
            var graph = {
                instanceId: 'testgraphid'
            };
            waterline.nodes.needByIdentifier.resolves(node);
            findActiveGraphForTarget.resolves(graph);
            this.sandbox.stub(workflowApiService, 'cancelTaskGraph').resolves(null);

            return expect(nodeApiService.delActiveWorkflowById('testnodeid'))
                .to.be.rejectedWith(Errors.NotFoundError);
        });
    });

    describe("_findTargetNodes", function() {
        before("_findTargetNodes before", function() {
        });

        it("_findTargetNodes should find related target nodes", function() {
            waterline.nodes.needByIdentifier.resolves(enclosureNode);

            return nodeApiService._findTargetNodes(computeNode.relations, 'enclosedBy')
            .then(function (nodes) {
                expect(waterline.nodes.needByIdentifier).to.have.been.calledOnce;
                expect(nodes[0]).to.equal(enclosureNode);
            });
        });

        it("_findTargetNodes should return nothing if cannot find target node", function() {
            waterline.nodes.needByIdentifier.rejects(Errors.NotFoundError(''));

            return nodeApiService._findTargetNodes(computeNode.relations, 'enclosedBy')
            .then(function (nodes) {
                expect(waterline.nodes.needByIdentifier).to.have.been.calledOnce;
                expect(nodes[0]).to.equal(undefined);
            });
        });

        it("_findTargetNodes should return nothing if don't have relations", function() {
            var node = {
                id: '1234abcd1234abcd1234abcd',
                type: 'compute'
            };

            return nodeApiService._findTargetNodes(node, 'enclosedBy')
            .then(function (nodes) {
                expect(nodes).to.deep.equal([]);
            });
        });

        it("_findTargetNodes should return nothing if node is null", function() {

            return nodeApiService._findTargetNodes(null, 'enclosedBy')
            .then(function (nodes) {
                expect(nodes).to.deep.equal([]);
            });
        });

    });

    describe("_needTargetNodes", function() {
        it("should fail if any target nodes cannot be found", function() {
            var error = new Errors.NotFoundError();
            waterline.nodes.needByIdentifier.rejects(error);
            return expect(nodeApiService._needTargetNodes(computeNode.relations, 'enclosedBy')
            ).to.be.rejectedWith(error);
        });
    });

    describe("_removeRelation", function() {

        beforeEach(function() {
            updateByIdentifier.resolves();
        });

        it("_removeRelation should return undefined if target node is null", function() {
            expect(nodeApiService._removeRelation(null, 'encloses', computeNode))
            .to.equal(undefined);
        });

        it("_removeRelation should fail if relation type is null", function() {
            var enclNode = {
                id: '1234abcd1234abcd1234abcd',
                type: 'enclNode'
            };

            expect(nodeApiService._removeRelation(enclNode, null, computeNode))
            .to.equal(undefined);
        });

        it("_removeRelation should fail if relationType is incorrect", function() {
            var enclNode = {
                    id: '1234abcd1234abcd1234abcd',
                    type: 'enclosure',
                    relations: [
                        {
                            "relationType": "enclosedBy",
                            "targets": [computeNode.id]
                        }
                    ]
                };

            expect(nodeApiService._removeRelation(enclNode, 'encloses', computeNode))
            .to.equal(undefined);
        });

        it("_removeRelation should fail if don't have targets", function() {
            var enclNode = {
                    id: '1234abcd1234abcd1234abcd',
                    type: 'enclosure',
                    relations: [
                        {
                            "relationType": "encloses"
                        }
                    ]
                };

            expect(nodeApiService._removeRelation(enclNode, 'encloses', computeNode))
            .to.equal(undefined);
        });

        it("_removeRelation should remove related id", function() {
           var enclRelationAfter = _.cloneDeep(enclosureNode.relations);
            _.pull(enclRelationAfter[0].targets, computeNode.id);

            expect(nodeApiService._removeRelation(enclosureNode, 'encloses', computeNode).relations)
            .to.deep.equal(enclRelationAfter);
        });

        it("_removeRelation should remove one relation when no target", function() {
            var enclNode = {
                id: '1234abcd1234abcd1234abcf',
                type: 'enclosure',
                relations: [
                    {
                        "relationType": "encloses",
                        "targets": [
                            "1234abcd1234abcd1234abcd",
                        ]
                    },
                    {
                        "relationType": "clusterBy",
                        "targets": [
                            "aaa",
                        ]
                    }
                ]
            };
            var enclRelationAfter = _.cloneDeep(enclNode.relations);
            _.pull(enclRelationAfter, enclRelationAfter[0]);
            expect(nodeApiService._removeRelation(enclNode, 'encloses', computeNode).relations)
            .to.deep.equal(enclRelationAfter);
        });

        it("_removeRelation should remain empty relation field when no relation", function() {
            var enclNode = {
                id: '1234abcd1234abcd1234abcf',
                type: 'enclosure',
                relations: [
                    {
                        "relationType": "encloses",
                        "targets": [
                            "1234abcd1234abcd1234abcd",
                        ]
                    }
                ]
            };
            var enclRelationAfter = [];
            expect(nodeApiService._removeRelation(enclNode, 'encloses', computeNode).relations)
            .to.deep.equal(enclRelationAfter);
        });
    });

    describe("_addRelation", function() {
        var computeNode2;
        beforeEach(function() {
            computeNode2 = {
                id: '1234abcd1234abcd1234abcx',
                type: 'compute',
                relations: [
                    {
                        "relationType": "enclosedBy",
                        "targets": [
                            "1234abcd1234abcd1234abcf"
                        ]
                    }
                ]
            };
            updateByIdentifier.resolves();
        });

        it("should do nothing if arguments are missing", function() {
            var argList = [rackNode, "contains", [computeNode]];
            expect(_.map(argList, function(arg, index) {
                var argsCopy = [].concat(argList);
                argsCopy[index] = undefined;
                return nodeApiService._addRelation(argsCopy[0], argsCopy[1], argsCopy[2]);
            })
            ).to.deep.equal([undefined, undefined, undefined]);
        });

        it("should return the node updated with new relations", function() {
            expect(nodeApiService._addRelation(
                rackNode, 'contains', [computeNode, computeNode2]).relations)
            .to.deep.equal(
                [{relationType: 'contains', targets: [computeNode.id, computeNode2.id]}]
            );

            rackNode.relations = [{relationType: 'contains', targets: [computeNode.id]}];
            expect(nodeApiService._addRelation(rackNode, 'contains', [computeNode2]).relations)
            .to.deep.equal(
                [{relationType: 'contains', targets: [computeNode.id, computeNode2.id]}]
            );
        });

        it('should fail to relate a node to itself', function() {
            expect(function() {
                return nodeApiService._addRelation(rackNode, 'contains', rackNode.id);
            }).to.throw("Node cannot have relationship contains with itself");
        });

        it('should fail to set a node as containedBy two other nodes', function() {
            var rackNode2 = _.cloneDeep(rackNode);
            rackNode2.id = 'secondRackNodeId';
            expect(function() {
                return nodeApiService._addRelation(
                    computeNode, 'containedBy', [rackNode.id, rackNode2.id]
                );
            }).to.throw("Node "+computeNode.id+" can only be contained by one node");
        });
    });

    describe("_getTargetsToBeRemoved ", function() {

        it("_getTargetsToBeRemoved should return undefined if target node is null", function() {
            expect(nodeApiService._getTargetsToBeRemoved(null, 'encloses', computeNode))
            .to.equal(undefined);
        });

        it("_getTargetsToBeRemoved should fail if relation type is null", function() {
            var enclNode = {
                id: '1234abcd1234abcd1234abcd',
                type: 'enclNode'
            };

            expect(nodeApiService._getTargetsToBeRemoved(enclNode, null, computeNode))
            .to.equal(undefined);
        });

        it("_getTargetsToBeRemoved should fail if relationType is incorrect", function() {
            var enclNode = {
                    id: '1234abcd1234abcd1234abcd',
                    type: 'enclosure',
                    relations: [
                        {
                            "relationType": "enclosedBy",
                            "targets": [computeNode.id]
                        }
                    ]
                };

            expect(nodeApiService._getTargetsToBeRemoved(enclNode, 'encloses', computeNode))
            .to.equal(undefined);
        });

        it("_getTargetsToBeRemoved should fail if don't have targets", function() {
            var enclNode = {
                    id: '1234abcd1234abcd1234abcd',
                    type: 'enclosure',
                    relations: [
                        {
                            "relationType": "encloses"
                        }
                    ]
                };

            expect(nodeApiService._getTargetsToBeRemoved(enclNode, 'encloses', computeNode))
            .to.equal(undefined);
        });

        it("_getTargetsToBeRemoved should fail if don't have relations", function() {
            var enclNode = {
                    id: '1234abcd1234abcd1234abcd',
                    type: 'enclosure',
                    relations: []
                };

            expect(nodeApiService._getTargetsToBeRemoved(enclNode, 'encloses', computeNode))
            .to.equal(undefined);
        });

        it("_getTargetsToBeRemoved should return related {index_path: [targets]}", function() {
           var values = { "relations.0.targets": ["1234abcd1234abcd1234abcd"] };

            expect(nodeApiService._getTargetsToBeRemoved(enclosureNode, 'encloses', computeNode))
            .to.deep.equal(values);
        });

    });

    describe("_getRelationsToBeRemoved ", function() {

        it("_getRelationsToBeRemoved should return undefined if target node is null", function() {
            expect(nodeApiService._getRelationsToBeRemoved(null, 'encloses'))
            .to.equal(undefined);
        });

        it("_getRelationsToBeRemoved should fail if relation type is null", function() {
            var enclNode = {
                id: '1234abcd1234abcd1234abcd',
                type: 'enclNode'
            };

            expect(nodeApiService._getRelationsToBeRemoved(enclNode, null))
            .to.equal(undefined);
        });

        it("_getRelationsToBeRemoved should fail if relationType is incorrect", function() {
            var enclNode = {
                    id: '1234abcd1234abcd1234abcd',
                    type: 'enclosure',
                    relations: [
                        {
                            "relationType": "enclosedBy",
                            "targets": [computeNode.id]
                        }
                    ]
                };

            expect(nodeApiService._getRelationsToBeRemoved(enclNode, 'encloses'))
            .to.equal(undefined);
        });

        it("_getRelationsToBeRemoved should return undefined if targets is not empty", function() {
            var enclNode = {
                    id: '1234abcd1234abcd1234abcd',
                    type: 'enclosure',
                    relations: [
                        {
                            "relationType": "encloses",
                            "targets": [computeNode.id]
                        }
                    ]
                };

            expect(nodeApiService._getRelationsToBeRemoved(enclNode, 'encloses'))
            .to.equal(undefined);
        });

        it("_getRelationsToBeRemoved should return related {relations: [relations]} if no target", 
           function() {
           var enclNodeBefore = _.cloneDeep(enclosureNode); 
           enclNodeBefore.relations[0].targets = [];
           var values = { "relations": [{"relationType": "encloses","targets":[]}] };

            expect(nodeApiService._getRelationsToBeRemoved(enclNodeBefore, 'encloses'))
            .to.deep.equal(values);
        });

    });

    describe("getNodeRelations", function() {
        it("should return the relations field of the requested node", function() {
            computeNode.relations = [{relationType: "enclosedBy", targets:[enclosureNode]}];
            waterline.nodes.needByIdentifier.resolves(computeNode);
            return nodeApiService.getNodeRelations(computeNode.id)
            .then(function(relations) {
                expect(relations).to.deep.equal(computeNode.relations);
                expect(waterline.nodes.needByIdentifier).to.be.calledOnce;
            });
        });
    });

    describe("editNodeRelations", function() {
        var body,
            handler,
            error,
            computeNode2;
        beforeEach(function() {
            computeNode2 = {
                id: '1234abcd1234abcd1234abcx',
                type: 'compute',
                relations: [
                    {
                        "relationType": "enclosedBy",
                        "targets": [
                            "1234abcd1234abcd1234abcf"
                        ]
                    }
                ]
            };

            body = {
                contains: [computeNode.id, computeNode2.id]
            };

            handler = this.sandbox.stub().resolves();
            error = new Errors.NotFoundError();
            this.sandbox.stub(nodeApiService, "_needTargetNodes");
            waterline.nodes.needByIdentifier.resolves(rackNode);
            waterline.nodes.updateByIdentifier.resolves();
        });

        afterEach(function() {
            this.sandbox.restore();
        });

        it("should delegate node updates to a handler", function() {
            nodeApiService._needTargetNodes.resolves([computeNode, computeNode2]);
            return nodeApiService.editNodeRelations(rackNode.id, body, handler)
            .then(function() {
                expect(handler).to.be.calledWithExactly(
                    rackNode, 'contains', [computeNode, computeNode2]
                );
                expect(handler).to.be.calledWithExactly(
                    computeNode, 'containedBy', rackNode
                );
                expect(handler).to.be.calledWithExactly(
                    computeNode2, 'containedBy', rackNode
                );
            });
        });

        it("should fail if any target nodes do not exist", function() {
            nodeApiService._needTargetNodes.rejects(error);
            return nodeApiService.editNodeRelations(rackNode.id, body, handler)
            .then(function() {
                throw new Error("expected function to fail");
            }).catch(function(e) {
                expect(e).to.equal(error);
            });
        });

        it("should fail if the node given by id does not exist", function() {
            waterline.nodes.needByIdentifier.rejects(error);
            return nodeApiService.editNodeRelations(rackNode.id, body, handler)
            .then(function() {
                throw new Error("expected function to fail");
            }).catch(function(e) {
                expect(e).to.equal(error);
            });
        });
    });

    describe("removeNode", function() {
        before("removeNode before", function() {
        });

        beforeEach(function() {
            this.sandbox.stub(waterline.lookups, 'update').resolves();
            this.sandbox.stub(waterline.nodes, 'destroy').resolves();
            this.sandbox.stub(waterline.workitems, 'destroy').resolves();
            this.sandbox.stub(waterline.catalogs, 'destroy').resolves();
        });

        it("removeNode should not delete target node when no constants defined", function() {
            var noopNode = {
                id: '1234abcd1234abcd1234abce',
                type: 'noop',
                relations: [
                    {
                        "relationType": "noops",
                        "targets": [
                            "1234abcd1234abcd1234abcd"
                        ]
                    }
                ]
            };
            var computeNodeBefore = _.cloneDeep(computeNode);
            computeNodeBefore.relations[0] = {
                "relationType": "noopedBy",
                "targets": ["1234abcd1234abcd1234abce"]
            };

            findActiveGraphForTarget.resolves('');
            needByIdentifier.resolves(noopNode);

            return nodeApiService.removeNode(computeNodeBefore)
            .then(function (node){
                expect(node).to.equal(computeNodeBefore);
                expect(removeListItemsByIdentifier).to.not.have.been.called;
                expect(waterline.nodes.destroy).to.have.been.calledOnce;
                expect(waterline.nodes.destroy).to.have.been
                    .calledWith({id: computeNodeBefore.id});
                expect(eventsProtocol.publishNodeEvent)
                    .to.have.been.calledWith(computeNodeBefore, "removed")
                    .to.have.been.calledOnce;
            });
        });

        it("removeNode should only delete required node when cannot get target node", function() {
            findActiveGraphForTarget.resolves('');
            needByIdentifier.rejects();

            return nodeApiService.removeNode(computeNode)
            .then(function (node){
                expect(node).to.equal(computeNode);
                expect(removeListItemsByIdentifier).to.not.have.been.called;
                expect(waterline.nodes.destroy).to.have.been.calledOnce;
                expect(eventsProtocol.publishNodeEvent)
                    .to.have.been.calledWith(computeNode, "removed")
                    .to.have.been.calledOnce;
            });
        });

        it("removeNode should only delete required node when no target node", function() {
            var noopNode = {
                id: '1234abcd1234abcd1234abcf',
                type: 'enclosure',
                relations: [
                    {
                        'relationType': 'encloses'
                    }
                ]
            };

            findActiveGraphForTarget.resolves('');
            return nodeApiService.removeNode(noopNode)
            .then(function (node){
                expect(node).to.equal(noopNode);
                expect(removeListItemsByIdentifier).to.not.have.been.called;
                expect(waterline.nodes.destroy).to.have.been.calledOnce;
                expect(eventsProtocol.publishNodeEvent)
                    .to.have.been.calledWith(noopNode, "removed")
                    .to.have.been.calledOnce;
            });
        });

        it("removeNode should only delete compute node when no compute node target", function() {
            var enclNode = {
                id: '1234abcd1234abcd1234abcf',
                type: 'enclosure',
                relations: [
                    {
                        "relationType": "encloses",
                        "targets": [
                            "1234abcd1234abcd1234abcd"
                        ]
                    }
                ]
            };
            var enclNodeAfter = _.cloneDeep(enclNode);
            _.pull(enclNodeAfter.relations, enclNodeAfter.relations[0]);

            findActiveGraphForTarget.resolves('');
            needByIdentifier.resolves(enclNode);

            this.sandbox.stub(nodeApiService, '_findTargetNodes').resolves([enclNodeAfter]);

            return nodeApiService.removeNode(computeNode)
            .then(function (node){
                expect(removeListItemsByIdentifier).to.not.have.been.called;
                expect(node).to.equal(computeNode);
                expect(waterline.nodes.destroy).to.have.been.calledOnce;
                expect(waterline.nodes.destroy).to.have.been.calledWith({id: computeNode.id});
                expect(eventsProtocol.publishNodeEvent)
                    .to.have.been.calledWith(computeNode, "removed")
                    .to.have.been.calledOnce;
            });
        });

        it("removeNode should delete compute node when deleting enclosure", function() {
            var computeNode2 = {
                id: '1234abcd1234abcd1234abce',
                type: 'compute',
                relations: [
                    {
                        "relationType": "enclosedBy",
                        "targets": [
                            "1234abcd1234abcd1234abcf"
                        ]
                    }
                ]
            };

            this.sandbox.stub(nodeApiService, '_findTargetNodes')
            .resolves([computeNode, computeNode2]);

            findActiveGraphForTarget.resolves('');
            needByIdentifier.withArgs(computeNode.id).resolves(computeNode);
            needByIdentifier.withArgs(computeNode2.id).resolves(computeNode2);

            return nodeApiService.removeNode(enclosureNode)
            .then(function (node){
                expect(node).to.equal(enclosureNode);
                expect(waterline.nodes.destroy).to.have.been.calledThrice;
                expect(waterline.nodes.destroy).to.have.been.calledWith({id: computeNode.id});
                expect(waterline.nodes.destroy).to.have.been.calledWith({id: computeNode2.id});
                expect(waterline.nodes.destroy).to.have.been.calledWith({id: enclosureNode.id});
                expect(eventsProtocol.publishNodeEvent)
                    .to.have.been.calledWith(enclosureNode, "removed")
                    .to.have.callCount(3);
            });
        });

        it("removeNode should update pdu node when deleting enclosure node", function() {
            var pduNode = {
                id: '1234abcd1234abcd1234abcg',
                type: 'pdu',
                relations: [
                    {
                        "relationType": "powers",
                        "targets": [
                            "1234abcd1234abcd1234abcd",
                            "aaa"
                        ]
                    }
                ]
            };
            var computeNode2 = {
                id: '1234abcd1234abcd1234abce',
                type: 'compute',
                relations: [
                    {
                        "relationType": "enclosedBy",
                        "targets": [
                            "1234abcd1234abcd1234abf",
                        ]
                    }
                ]
            };

            var pduNodeAfter = _.cloneDeep(pduNode);
            _.pull(pduNodeAfter.relations[0].targets, pduNodeAfter.relations[0].targets[0]);
            var computeNodeBefore = _.cloneDeep(computeNode);
            computeNodeBefore.relations[1] = {
                "relationType": "poweredBy",
                "targets": ["1234abcd1234abcd1234abcg"]
            };

            var targets = { "relations.0.targets": ["1234abcd1234abcd1234abcd"] };

            findActiveGraphForTarget.resolves('');
            needByIdentifier.withArgs(computeNode.id).resolves(computeNodeBefore);
            needByIdentifier.withArgs(computeNode2.id).resolves(computeNode2);
            needByIdentifier.withArgs(pduNode.id).resolves(pduNode);
            removeListItemsByIdentifier.withArgs(pduNode.id, targets).resolves(pduNodeAfter);

            return nodeApiService.removeNode(enclosureNode)
            .then(function (node){
                expect(node).to.equal(enclosureNode);
                expect(waterline.nodes.destroy).to.have.been.calledTrice;
                expect(removeListItemsByIdentifier).to.have.been
                    .calledWith(pduNode.id, targets);
                expect(eventsProtocol.publishNodeEvent)
                    .to.have.been.calledWith(enclosureNode, "removed")
                    .to.have.callCount(3);
            });
        });

        it("removeNode should remove relations with blank target list in compute node target node",
            function() {
            var enclNode = {
                id: '1234abcd1234abcd1234abcf',
                type: 'enclosure',
                relations: [
                    {
                        "relationType": "encloses",
                        "targets": [
                            "1234abcd1234abcd1234abcd"
                        ]
                    }
                ]
            };
            var enclNodeAfter = _.cloneDeep(enclNode);
            _.pull(enclNodeAfter.relations[0].targets, enclNodeAfter.relations[0].targets[0]);

            var targets = { "relations.0.targets": ["1234abcd1234abcd1234abcd"] }; 
            removeListItemsByIdentifier.withArgs(enclNode.id, targets).resolves(enclNodeAfter);

            var relations = { "relations": [{"relationType": "encloses", "targets": []}] };

            findActiveGraphForTarget.resolves('');
            needByIdentifier.resolves(enclNode);

            this.sandbox.stub(nodeApiService, '_findTargetNodes').resolves([enclNode]);

            return nodeApiService.removeNode(computeNode)
            .then(function (node){
                expect(removeListItemsByIdentifier).to.have.been.calledTwice;
                expect(removeListItemsByIdentifier).to.have.been
                    .calledWith(enclNode.id, targets);
                expect(removeListItemsByIdentifier).to.have.been
                    .calledWith(enclNode.id, relations);
                expect(node).to.equal(computeNode);
                expect(waterline.nodes.destroy).to.have.been.calledOnce;
                expect(waterline.nodes.destroy).to.have.been.calledWith({id: computeNode.id});
                expect(eventsProtocol.publishNodeEvent)
                    .to.have.been.calledWith(computeNode, "removed")
                    .to.have.been.calledOnce;
            });
        });

        it("removeNode should not delete enlosure when active workflow", function(done) {
            var computeNode2 = {
                id: '1234abcd1234abcd1234abce',
                type: 'compute',
                relations: [
                    {
                        "relationType": "enclosedBy",
                        "targets": [
                            "1234abcd1234abcd1234abcf"
                        ]
                    }
                ]
            };
            var computeNodeAfter = _.cloneDeep(computeNode);
            var computeNode2After = _.cloneDeep(computeNode2);
            delete computeNodeAfter.relations;
            delete computeNode2After.relations;

            findActiveGraphForTarget.resolves(null);
            findActiveGraphForTarget.withArgs(computeNode2.id).resolves('1');
            needByIdentifier.withArgs(computeNode.id).resolves(computeNode);
            needByIdentifier.withArgs(computeNode2.id).resolves(computeNode2);

            nodeApiService.removeNode(enclosureNode)
            .then(function() {
                done(new Error("Expected job to fail"));
            })
            .catch(function(e) {
                try {
                    expect(e).to.equal('Could not remove node ' + computeNode2.id +
                        ', active workflow is running');
                    expect(waterline.nodes.destroy).to.not.have.been.called;
                    expect(removeListItemsByIdentifier).to.not.have.been.called;
                    expect(eventsProtocol.publishNodeEvent).to.not.have.been.called;
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });

    });

    describe('Tagging', function() {

        var node = {
            id: '1234abcd1234abcd1234abcd',
            tags: ['name1'],
            type: 'compute',
        };
        var node1 = {
            id: '5678efgh5678efgh5678efgh',
            tags: ['name1'],
            type: 'compute',
        };

        before(function() {
            waterline.nodes.addTags = sinon.stub().resolves();
            waterline.nodes.remTags = sinon.stub().resolves();
            waterline.nodes.findByTag = sinon.stub().resolves();
        });

        beforeEach(function() {
            waterline.nodes.addTags.reset();
            waterline.nodes.remTags.reset();
            waterline.nodes.findByTag.reset();
        });

        after(function() {
            delete waterline.nodes.addTags;
            delete waterline.nodes.remTags;
            delete waterline.nodes.findByTag;
        });

        it('should call waterline to add a tag array', function() {
            var tags = ['tag'];
            needByIdentifier.withArgs(node.id).resolves(node);
            return nodeApiService.addTagsById(node.id, tags)
                .then(function() {
                    expect(waterline.nodes.addTags).to.have.been.calledWith(node.id, tags);
                    expect(needByIdentifier).to.have.been.calledWith(node.id);
                });
        });

        it('should reject an invalid tag array', function() {
            return nodeApiService.addTagsById(node.id, 'tag')
                .catch(function(e) {
                    expect(e).to.have.property('name').that.equals('AssertionError');
                    expect(waterline.nodes.addTags).to.not.be.called;
                    expect(needByIdentifier).to.not.be.called;
                });
        });

        it('should call waterline to remove a tag', function() {
            needByIdentifier.withArgs(node.id).resolves(node);
            return nodeApiService.removeTagsById(node.id, 'tag')
                .then(function() {
                    expect(waterline.nodes.remTags).to.have.been.calledWith(node.id, 'tag');
                    expect(needByIdentifier).to.have.been.calledWith(node.id);
                });
        });

        it('should reject an invalid tag', function() {
            return nodeApiService.removeTagsById(node.id, 1)
                .catch(function(e) {
                    expect(e).to.have.property('name').that.equals('AssertionError');
                    expect(waterline.nodes.remTags).to.not.be.called;
                    expect(needByIdentifier).to.not.be.called;
                });
        });

        it('should call waterline to get tags on a node', function() {
            needByIdentifier.withArgs(node.id).resolves(node);
            return nodeApiService.getTagsById(node.id)
                .then(function() {
                    expect(needByIdentifier).to.have.been.calledWith(node.id);
                });
        });

        it('should call waterline to get nodes with the tag', function() {
            return nodeApiService.getNodesByTag('tag')
                .then(function() {
                    expect(waterline.nodes.findByTag).to.have.been.calledWith('tag');
                });
        });

        it('should reject an invalid tag', function() {
            return nodeApiService.getNodesByTag(1)
                .catch(function(e) {
                    expect(e).to.have.property('name').that.equals('AssertionError');
                    expect(waterline.nodes.findByTag).to.not.be.called;
                    expect(needByIdentifier).to.not.be.called;
                });
        });

        it('should call waterline to get list of nodes and remove the specified' +
            ' tag', function() {
            var tagName = 'name1';
            waterline.nodes.findByTag.resolves([node, node1]);
            return nodeApiService.masterDelTagById(tagName)
                .then(function() {
                    expect(waterline.nodes.remTags).to.have.been.calledWith(node.id,tagName);
                    expect(waterline.nodes.remTags).to.have.been.calledWith(node1.id,tagName);
                });
        });
    });

    describe('Obms', function() {

        var node = {
            id: '1234abcd1234abcd1234abcd',
            name: 'name',
            type: 'compute',
            obms: [
                {
                    service: 'ipmi-obm-service',
                    config: {
                        host: '1.2.3.4',
                        user: 'myuser',
                        password: 'mypass'
                    }
                }
            ]
        };

        var obm = {
            id: '5678efgh5678efgh5678efgh',
            node: '/api/2.0/nodes/1234abcd1234abcd1234abcd',
            service: 'ipmi-obm-service',
            config: {
                host: '1.2.3.4',
                user: 'myuser',
                password: 'mypass'
            }
        };


        it('should add an OBM to a node', function () {
            waterline.nodes.getNodeById.resolves(node);
            waterline.obms.upsertByNode.resolves();
            return nodeApiService.putObmsByNodeId(node.id, obm)
                .then(function() {
                    expect(waterline.nodes.getNodeById).to.have.been.calledOnce;
                    expect(
                        waterline.nodes.getNodeById.firstCall.args[0]
                    ).to.equal(node.id);
                    expect(waterline.obms.upsertByNode).to.have.been.calledOnce;
                    expect(waterline.obms.upsertByNode.firstCall.args[0]).to.equal(node.id);
                    expect(waterline.obms.upsertByNode.firstCall.args[1]).to.deep.equal(obm);

                });

        });

        it('should report node not found for PUT', function () {
            waterline.nodes.getNodeById.resolves();

            return expect(nodeApiService.putObmsByNodeId(node.id))
                .to.be.rejectedWith(Errors.NotFoundError);

        });

        it('should look up the OBMs for a node', function () {
            waterline.nodes.getNodeById.resolves(node);
            waterline.obms.findAllByNode.resolves(obm);
            return nodeApiService.getObmsByNodeId(node.id)
                .then(function(ret) {
                    expect(waterline.nodes.getNodeById).to.have.been.calledOnce;
                    expect(
                        waterline.nodes.getNodeById.firstCall.args[0]
                    ).to.equal(node.id);
                    expect(ret).to.deep.equal(obm);
                });
        });

        it('should report node not found for GET', function () {
            waterline.nodes.getNodeById.resolves();

            return expect(nodeApiService.getObmsByNodeId(node.id))
                .to.be.rejectedWith(Errors.NotFoundError);
        });

    });
});
