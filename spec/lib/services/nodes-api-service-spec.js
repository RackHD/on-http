// Copyright 2015, EMC, Inc.
/* jshint node:true */

"use strict";

describe("Http.Services.Api.Nodes", function () {
    var nodeApiService;
    var Errors;
    var taskGraphProtocol;
    var waterline;

    var computeNode = {
        id: '1234abcd1234abcd1234abcd',
        name: 'computeNode',
        relations: [
            {
                "relationType": "enclosedBy",
                "targets": [
                    "1234abcd1234abcd1234abcf"
                ]
            }
        ]
    };
    var enclosureNode = {
        id: '1234abcd1234abcd1234abcf',
        name: 'enclosureNode',
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
    var enclosureNode1 = {
        id: '1234abcd1234abcd1234abcf',
        name: 'enclosureNode',
        relations: [
            {
                "relationType": "encloses",
                "targets": [
                    "1234abcd1234abcd1234abcd"
                ]
            }
        ]
    };

    before("Http.Services.Api.Nodes before", function() {
        helper.setupInjector([
            helper.require("/lib/services/nodes-api-service")
        ]);
        nodeApiService = helper.injector.get("Http.Services.Api.Nodes");
        Errors = helper.injector.get("Errors");
        taskGraphProtocol = helper.injector.get("Protocol.TaskGraphRunner");
        waterline = helper.injector.get('Services.Waterline');
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
    });

    afterEach("Http.Services.Api.Nodes afterEach", function() {
        this.sandbox.restore();
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

        it("removeNode should fail when a workflow is running", function() {
            this.sandbox.stub(taskGraphProtocol, 'getActiveTaskGraph').resolves('true');
            return expect(nodeApiService.removeNode(computeNode))
                   .to.be.rejectedWith(Errors.BadRequestError);
        });

        it("removeNode should remove one node", function() {
            this.sandbox.stub(taskGraphProtocol, 'getActiveTaskGraph').resolves('');
            this.sandbox.stub(nodeApiService, '_findEnclNodes').resolves();
            this.sandbox.stub(nodeApiService, '_removeEnclRelations').resolves();

            return nodeApiService.removeNode(computeNode)
            .then(function (node) {
                expect(waterline.lookups.update).to.have.been.calledOnce;
                expect(waterline.nodes.destroy).to.have.been.calledOnce;
                expect(waterline.catalogs.destroy).to.have.been.calledOnce;
                expect(waterline.workitems.destroy).to.have.been.calledOnce;
                expect(nodeApiService._findEnclNodes).to.have.been.calledOnce;
                expect(nodeApiService._removeEnclRelations).to.have.been.calledOnce;
                expect(node).to.equal(computeNode);
            });
        });
    });
    describe("_findEnclNodes", function() {
        before("_findEnclNodes before", function() {
        });

        beforeEach(function() {
        });

        it("_findEnclNodes should find related enclosure nodes", function() {
            this.sandbox.stub(waterline.nodes, 'needByIdentifier').resolves(enclosureNode);

            return nodeApiService._findEnclNodes(computeNode)
            .then(function (nodes) {
                expect(waterline.nodes.needByIdentifier).to.have.been.calledOnce;
                expect(nodes[0]).to.equal(enclosureNode);
            });
        });

        it("_findEnclNodes should return nothing if cannot find enclosure node", function() {
            this.sandbox.stub(waterline.nodes, 'needByIdentifier').rejects(Errors.NotFoundError(''));

            return nodeApiService._findEnclNodes(computeNode)
            .then(function (nodes) {
                expect(waterline.nodes.needByIdentifier).to.have.been.calledOnce;
                expect(nodes[0]).to.equal(undefined);
            });
        });

        it("_findEnclNodes should return nothing if don't have relations", function() {
            var node = {
                id: '1234abcd1234abcd1234abcd',
                name: 'computeNode'
            };

            return nodeApiService._findEnclNodes(node)
            .then(function (nodes) {
                expect(nodes).to.equal(undefined);
            });
        });

        it("_findEnclNodes should return nothing if node is null", function() {

            return nodeApiService._findEnclNodes(null)
            .then(function (nodes) {
                expect(nodes).to.equal(undefined);
            });
        });

    });

    describe("_removeEnclRelations", function() {
        before("_removeEnclRelations before", function() {
        });

        beforeEach(function() {
            this.sandbox.stub(waterline.nodes, 'updateByIdentifier').resolves();
            this.sandbox.stub(waterline.nodes, 'destroy').resolves();
        });

        it("_removeEnclRelations should fail if enclosure node is null", function() {
            return nodeApiService._removeEnclRelations(computeNode, null)
            .then(function () {
                expect(waterline.nodes.updateByIdentifier).to.not.have.been.called;
                expect(waterline.nodes.destroy).to.not.have.been.called;
            });
        });

        it("_removeEnclRelations should fail if enclosure node is null", function() {
            var enclNodes = [
                {
                    id: '1234abcd1234abcd1234abcd',
                    name: 'computeNode'
                }
            ];

            return nodeApiService._removeEnclRelations(computeNode, enclNodes)
            .then(function () {
                expect(waterline.nodes.updateByIdentifier).to.not.have.been.called;
                expect(waterline.nodes.destroy).to.not.have.been.called;
            });
        });

        it("_removeEnclRelations should fail if relationType is incorrect", function() {
            var enclNodes = [
                {
                    id: '1234abcd1234abcd1234abcd',
                    name: 'computeNode',
                    relations: [
                        {
                            "relationType": "enclosedBy",
                        }
                    ]
                }
            ];

            return nodeApiService._removeEnclRelations(computeNode, enclNodes)
            .then(function () {
                expect(waterline.nodes.updateByIdentifier).to.not.have.been.called;
                expect(waterline.nodes.destroy).to.not.have.been.called;
            });
        });

        it("_removeEnclRelations should fail if don't have targets", function() {
            var enclNodes = [
                {
                    id: '1234abcd1234abcd1234abcd',
                    name: 'computeNode',
                    relations: [
                        {
                            "relationType": "encloses"
                        }
                    ]
                }
            ];

            return nodeApiService._removeEnclRelations(computeNode, enclNodes)
            .then(function () {
                expect(waterline.nodes.updateByIdentifier).to.not.have.been.called;
                expect(waterline.nodes.destroy).to.not.have.been.called;
            });
        });

        it("_removeEnclRelations should remove relations", function() {
            return nodeApiService._removeEnclRelations(computeNode, [enclosureNode])
            .then(function () {
                expect(waterline.nodes.updateByIdentifier).to.have.been.calledOnce;
            });
        });

        it("_removeEnclRelations should remove enclosure node when it has no relations", function() {
            return nodeApiService._removeEnclRelations(computeNode, [enclosureNode1])
            .then(function () {
                expect(waterline.nodes.destroy).to.have.been.calledOnce;
            });
        });
    });
});
