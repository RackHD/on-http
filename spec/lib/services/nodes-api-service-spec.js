// Copyright 2016, EMC, Inc.

"use strict";

describe("Http.Services.Api.Nodes", function () {
    var nodeApiService;
    var workflowApiService;
    var Errors;
    var waterline;
    var updateByIdentifier;
    var create;
    var needByIdentifier;
    var findActiveGraphForTarget;
    var computeNode;
    var enclosureNode;
    var _;

    before("Http.Services.Api.Nodes before", function() {
        helper.setupInjector([
            onHttpContext.prerequisiteInjectables,
            helper.require("/lib/services/nodes-api-service"),
            helper.require("/lib/services/workflow-api-service"),
            dihelper.simpleWrapper({}, 'Task.Services.OBM'),
            dihelper.simpleWrapper({}, 'ipmi-obm-service')
        ]);
        nodeApiService = helper.injector.get("Http.Services.Api.Nodes");
        workflowApiService = helper.injector.get("Http.Services.Api.Workflows");
        Errors = helper.injector.get("Errors");
        waterline = helper.injector.get('Services.Waterline');
        _ = helper.injector.get('_');
        waterline.nodes = {
            create: function() {},
            needByIdentifier: function() {},
            updateByIdentifier: function() {},
            destroy: function() {}
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

        create = this.sandbox.stub(waterline.nodes, 'create');
        needByIdentifier = this.sandbox.stub(waterline.nodes, 'needByIdentifier');
        updateByIdentifier = this.sandbox.stub(waterline.nodes, 'updateByIdentifier');
        findActiveGraphForTarget = this.sandbox.stub(
                workflowApiService, 'findActiveGraphForTarget');

    });

    afterEach("Http.Services.Api.Nodes afterEach", function() {
        this.sandbox.restore();
    });

    describe("postNode", function() {
        var node = {
            id: '1234abcd1234abcd1234abcd',
            name: 'name',
            type: 'compute',
            obmSettings: [
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

        it('should create a node', function () {
            waterline.nodes.create.resolves(node);
            return nodeApiService.postNode(node)
            .then(function() {
                expect(waterline.nodes.create).to.have.been.calledOnce;
                expect(
                    waterline.nodes.create.firstCall.args[0]
                ).to.have.property('id').and.equal(node.id);
            });
        });

        it('should run discovery if the requested node is an autoDiscoverable switch', function() {
            var switchNode = {
                id: '1234abcd1234abcd1234abcd',
                name: 'name',
                snmpSettings: {
                    host: '1.2.3.4',
                    community: 'community'
                },
                autoDiscover: true,
                type: 'switch'
            };

            waterline.nodes.create.resolves(switchNode);
            this.sandbox.stub(workflowApiService, 'createAndRunGraph').resolves({});

            return nodeApiService.postNode({})
            .then(function() {
                expect(workflowApiService.createAndRunGraph).to.have.been.calledOnce;
                expect(workflowApiService.createAndRunGraph).to.have.been.calledWith(
                    {
                        name: 'Graph.Switch.Discovery',
                        options: { defaults: switchNode.snmpSettings }
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
                obmSettings: [
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

            return nodeApiService.postNode({})
            .then(function() {
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
                snmpSettings: {
                    host: '1.2.3.4',
                    community: 'community'
                },
                autoDiscover: true,
                type: 'pdu'
            };
            waterline.nodes.create.resolves(pduNode);
            this.sandbox.stub(workflowApiService, 'createAndRunGraph').resolves({});

            return nodeApiService.postNode({})
            .then(function() {
                expect(workflowApiService.createAndRunGraph).to.have.been.calledOnce;
                expect(workflowApiService.createAndRunGraph).to.have.been.calledWith(
                    {
                        name: 'Graph.PDU.Discovery',
                        options: { defaults: pduNode.snmpSettings }
                    },
                    pduNode.id
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
                id: 'testgraphid'
            };
            waterline.nodes.needByIdentifier.resolves(node);
            findActiveGraphForTarget.resolves(graph);
            this.sandbox.stub(workflowApiService, 'cancelTaskGraph').resolves(graph.id);

            return nodeApiService.delActiveWorkflowById('testnodeid')
            .then(function() {
                expect(findActiveGraphForTarget).to.have.been.calledOnce;
                expect(findActiveGraphForTarget)
                    .to.have.been.calledWith(node.id);
                expect(workflowApiService.cancelTaskGraph).to.have.been.calledOnce;
                expect(workflowApiService.cancelTaskGraph)
                    .to.have.been.calledWith(graph.id);
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
            needByIdentifier.resolves(enclosureNode);

            return nodeApiService._findTargetNodes(computeNode, 'enclosedBy')
            .then(function (nodes) {
                expect(needByIdentifier).to.have.been.calledOnce;
                expect(nodes[0]).to.equal(enclosureNode);
            });
        });

        it("_findTargetNodes should return nothing if cannot find target node", function() {
            needByIdentifier.rejects(Errors.NotFoundError(''));

            return nodeApiService._findTargetNodes(computeNode, 'enclosedBy')
            .then(function (nodes) {
                expect(needByIdentifier).to.have.been.calledOnce;
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

    describe("_removeRelation", function() {
        before("_removeRelation before", function() {
        });

        beforeEach(function() {
            updateByIdentifier.resolves();
        });

        it("_removeRelation should fail if target node is null", function() {
            return nodeApiService._removeRelation(null, 'encloses', computeNode.id)
            .then(function () {
                expect(updateByIdentifier).to.not.have.been.called;
            });
        });

        it("_removeRelation should fail if relation type of target node is null", function() {
            var enclNodes = [
                {
                    id: '1234abcd1234abcd1234abcd',
                    type: 'enclNode'
                }
            ];

            return nodeApiService._removeRelation(enclNodes, 'encloses', computeNode.id)
            .then(function () {
                expect(updateByIdentifier).to.not.have.been.called;
            });
        });

        it("_removeRelation should fail if relationType is incorrect", function() {
            var enclNodes = [
                {
                    id: '1234abcd1234abcd1234abcd',
                    type: 'compute',
                    relations: [
                        {
                            "relationType": "enclosedBy",
                        }
                    ]
                }
            ];

            return nodeApiService._removeRelation(enclNodes, 'encloses', computeNode.id)
            .then(function () {
                expect(updateByIdentifier).to.not.have.been.called;
            });
        });

        it("_removeRelation should fail if don't have targets", function() {
            var enclNodes = [
                {
                    id: '1234abcd1234abcd1234abcd',
                    type: 'enclosure',
                    relations: [
                        {
                            "relationType": "encloses"
                        }
                    ]
                }
            ];

            return nodeApiService._removeRelation(enclNodes, 'encloses', computeNode.id)
            .then(function () {
                expect(updateByIdentifier).to.not.have.been.called;
            });
        });

        it("_removeRelation should remove related id", function() {
            var enclRelationAfter = _.cloneDeep(enclosureNode.relations);
            _.pull(enclRelationAfter[0].targets, computeNode.id);

            return nodeApiService._removeRelation(enclosureNode, 'encloses', computeNode.id)
            .then(function () {
                expect(updateByIdentifier).to.have.been
                    .calledWith(enclosureNode.id,
                                {relations: enclRelationAfter});
            });
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
            return nodeApiService._removeRelation(enclNode, 'encloses', computeNode.id)
            .then(function () {
                expect(updateByIdentifier)
                   .to.have.been.calledWith(enclNode.id,
                                            {relations: enclRelationAfter});
            });
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
            return nodeApiService._removeRelation(enclNode, 'encloses', computeNode.id)
            .then(function () {
                expect(updateByIdentifier)
                    .to.have.been.calledWith(enclNode.id,
                                             {relations: enclRelationAfter});
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
                expect(updateByIdentifier).to.not.have.been.called;
                expect(waterline.nodes.destroy).to.have.been.calledOnce;
                expect(waterline.nodes.destroy).to.have.been
                    .calledWith({id: computeNodeBefore.id});
            });
        });

        it("removeNode should only delete required node when cannot get target node", function() {
            findActiveGraphForTarget.resolves('');
            needByIdentifier.rejects();

            return nodeApiService.removeNode(computeNode)
            .then(function (node){
                expect(node).to.equal(computeNode);
                expect(updateByIdentifier).to.not.have.been.called;
                expect(waterline.nodes.destroy).to.have.been.calledOnce;
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
                expect(updateByIdentifier).to.not.have.been.called;
                expect(waterline.nodes.destroy).to.have.been.calledOnce;
            });
        });

        it("removeNode should only update enclosure node when no compute node target", function() {
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
            updateByIdentifier.resolves(enclNodeAfter);

            return nodeApiService.removeNode(computeNode)
            .then(function (node){
                expect(updateByIdentifier).to.have.been
                    .calledWith(enclNode.id,
                                {relations: enclNodeAfter.relations});
                expect(node).to.equal(computeNode);
                expect(waterline.nodes.destroy).to.have.been.calledOnce;
                expect(waterline.nodes.destroy).to.have.been.calledWith({id: computeNode.id});
            });
        });

        it("removeNode should delete compute node when deleting enlosure", function() {
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

            findActiveGraphForTarget.resolves('');
            needByIdentifier.withArgs(computeNode.id).resolves(computeNode);
            needByIdentifier.withArgs(computeNode2.id).resolves(computeNode2);
            updateByIdentifier.withArgs(computeNode.id).resolves(computeNodeAfter);
            updateByIdentifier.withArgs(computeNode2.id).resolves(computeNode2After);

            return nodeApiService.removeNode(enclosureNode)
            .then(function (node){
                expect(node).to.equal(enclosureNode);
                expect(waterline.nodes.destroy).to.have.been.calledThrice;
                expect(waterline.nodes.destroy).to.have.been.calledWith({id: computeNode.id});
                expect(waterline.nodes.destroy).to.have.been.calledWith({id: computeNode2.id});
                expect(waterline.nodes.destroy).to.have.been.calledWith({id: enclosureNode.id});
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

            findActiveGraphForTarget.resolves('');
            needByIdentifier.withArgs(computeNode.id).resolves(computeNodeBefore);
            needByIdentifier.withArgs(computeNode2.id).resolves(computeNode2);
            needByIdentifier.withArgs(pduNode.id).resolves(pduNode);
            updateByIdentifier.withArgs(pduNode.id).resolves(pduNodeAfter);

            return nodeApiService.removeNode(enclosureNode)
            .then(function (node){
                expect(node).to.equal(enclosureNode);
                expect(waterline.nodes.destroy).to.have.been.calledTrice;
                expect(updateByIdentifier).to.have.been
                    .calledWith(pduNode.id,
                                {relations: pduNodeAfter.relations});
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
            updateByIdentifier.withArgs(computeNode.id).resolves(computeNodeAfter);
            updateByIdentifier.withArgs(computeNode2.id).resolves(computeNode2After);

            return nodeApiService.removeNode(enclosureNode)
            .then(function() {
                done(new Error("Expected job to fail"));
            })
            .catch(function(e) {
                try {
                    expect(e).to.equal('Could not remove node ' + computeNode2.id +
                        ', active workflow is running');
                    expect(waterline.nodes.destroy).to.not.have.been.called;
                    expect(updateByIdentifier).to.not.have.been.called;
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });

    });

    describe('Tagging', function() {
        var node = {
            id: '1234abcd1234abcd1234abce'
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
    });
});
