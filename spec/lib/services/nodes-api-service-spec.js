// Copyright 2015, EMC, Inc.
/* jshint node:true */

"use strict";

describe("Http.Services.Api.Nodes", function () {
    var nodeApiService;
    var Errors;
    var taskGraphProtocol;
    var waterline;
    var updateByIdentifier;
    var needByIdentifier;
    var getActiveTaskGraph;
    var computeNode;
    var enclosureNode;
    var _;

    before("Http.Services.Api.Nodes before", function() {
        helper.setupInjector([
            helper.require("/lib/services/nodes-api-service")
        ]);
        nodeApiService = helper.injector.get("Http.Services.Api.Nodes");
        Errors = helper.injector.get("Errors");
        taskGraphProtocol = helper.injector.get("Protocol.TaskGraphRunner");
        waterline = helper.injector.get('Services.Waterline');
        _ = helper.injector.get('_');
        waterline.nodes = {
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

        needByIdentifier = this.sandbox.stub(waterline.nodes, 'needByIdentifier');
        updateByIdentifier = this.sandbox.stub(waterline.nodes, 'updateByIdentifier');
        getActiveTaskGraph = this.sandbox.stub(taskGraphProtocol, 'getActiveTaskGraph');

    });

    afterEach("Http.Services.Api.Nodes afterEach", function() {
        this.sandbox.restore();
    });

    describe("_findTargetNodes", function() {
        before("_findTargetNodes before", function() {
        });

        beforeEach(function() {
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

            getActiveTaskGraph.resolves('');
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
            getActiveTaskGraph.resolves('');
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

            getActiveTaskGraph.resolves('');
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

            getActiveTaskGraph.resolves('');
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

            getActiveTaskGraph.resolves('');
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

            getActiveTaskGraph.resolves('');
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

            getActiveTaskGraph.resolves('');
            getActiveTaskGraph.withArgs({target: computeNode2.id}).resolves('1');
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

});
