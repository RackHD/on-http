// Copyright 2016, EMC, Inc.
/* jshint node:true */

"use strict";

describe("Http.Services.Api.Pollers", function () {
    var pollerService;
    var waterline;
    var taskProtocol;

    before("Http.Services.Api.Pollers before", function() {
        helper.setupInjector([
            helper.require("/lib/services/pollers-api-service.js")
        ]);

        waterline = helper.injector.get("Services.Waterline");
        waterline.workitems = {
            needByIdentifier: sinon.stub().resolves(),
            find: sinon.stub().resolves([]),
            create: sinon.stub().resolves(),
            updateByIdentifier: sinon.stub().resolves(),
            destroyByIdentifier: sinon.stub().resolves()
        };

	taskProtocol = helper.injector.get("Protocol.Task");
        taskProtocol.requestPollerCache = sinon.stub();
        pollerService = helper.injector.get("Http.Services.Api.Pollers");

    });

    describe("getPollers", function() {
        it("should expose the appropriate methods", function() {
            pollerService.should.have.property("getPollers")
                .that.is.a("function").with.length(1);
        });

        it("Run getPollers", function() {
            var mockPoller = [{
                id: "4532",
                name: "Pollers.IPMI",
                config: {}
            }];

            waterline.workitems.find.resolves(mockPoller);
            return pollerService.getPollers().then(function (pollers) {
                expect(pollers).to.deep.equal(mockPoller);
            });
        });
        it('should return error if poller informations is not found', function () {
            var mockPoller = {"message":"NotFoundError: Could not find workitem with identifier"};
            waterline.workitems.find.rejects(mockPoller);
            return pollerService.getPollers().should.eventually.be.rejectedWith(mockPoller);
        });

    });

    describe("getPollersById", function() {
        it("should expose the appropriate methods", function() {
            pollerService.should.have.property("getPollersById")
            .that.is.a("function").with.length(1);
        });

        it("Run getPollersById", function() {
            var mockPoller = [{
                id: "1234",
                name: "Pollers.IPMI",
                config: {}
            },
            {
                id: "4532",
                name: "Pollers.TEST",
                config: {}
            }];
            waterline.workitems.needByIdentifier.withArgs({"id": "4532"}).resolves(mockPoller[0]);
            waterline.workitems.needByIdentifier.withArgs({"id": "1234"}).resolves(mockPoller[1]);
            Promise.all(["4532", "1234"].map(function(id, index) {
                return pollerService.getPollersById(index)})).then(function (pollers) {
                    expect(pollers).to.deep.equal(mockPoller[index]);
                });
         });

        it("should return error if specific poller info is not found", function () {
            var mockPoller = {"message":"NotFoundError: Could not find workitem with identifier"};
            waterline.workitems.needByIdentifier.rejects(mockPoller);
            return pollerService.getPollersById().should.eventually.be.rejectedWith(mockPoller);
        });

    });

    describe("getPollerLib", function() {
        it("should expose the appropriate methods", function() {
            pollerService.should.have.property("getPollerLib")
            .that.is.a("function").with.length(0);
        });

    });

    describe("getPollerLibById", function() {
        it("should expose the appropriate methods", function() {
            pollerService.should.have.property("getPollerLibById")
            .that.is.a("function").with.length(1);
        });

    });

    describe("postPollers", function() {
        it("should expose the appropriate methods", function() {
            pollerService.should.have.property("postPollers")
            .that.is.a("function").with.length(1);
        });

        it("Run postPollers", function() {
            var mockPoller = [{
                id: "4532",
                name: "Pollers.IPMI",
                config: {}
            }];
            waterline.workitems.create.resolves(mockPoller);
            return pollerService.postPollers().then(function (pollers) {
                expect(pollers).to.deep.equal(mockPoller);
            });
        });

        it("Throws error when  postPollers runs with invalid input", function() {
            var mockPoller = {
                "message": "Validation errors"
            };
            waterline.workitems.create.rejects(mockPoller);
            return pollerService.postPollers().should.eventually.be.rejectedWith(mockPoller);
        });
    });


    describe("patchPollersById", function() {
        it("should expose the appropriate methods", function() {
            pollerService.should.have.property("patchPollersById")
            .that.is.a("function").with.length(2);
        });

        it("Run patchPollersById", function() {
            var mockPoller = [{
                id: "4532",
                name: "Pollers.IPMI",
                config: {},
                paused: "true"
            }];
            waterline.workitems.updateByIdentifier.resolves(mockPoller);
            return pollerService.patchPollersById().then(function (pollers) {
                expect(pollers).to.deep.equal(mockPoller);
            });
        });
    });

    describe("patchPollersByIdPause", function() {
        it("should expose the appropriate methods", function() {
            pollerService.should.have.property("patchPollersByIdPause")
            .that.is.a("function").with.length(1);
        });


        it("Run patchPollersByIdPause", function() {
            var mockPoller = [{
                id: "4532",
                name: "Pollers.IPMI",
                config: {},
                paused: "true"
            }];
            waterline.workitems.updateByIdentifier.resolves(mockPoller);
            return pollerService.patchPollersByIdPause().then(function (pollers) {
                expect(pollers).to.deep.equal(mockPoller);
            });
        });
    });

    describe("patchPollersByIdResume", function() {
        it("should expose the appropriate methods", function() {
            pollerService.should.have.property("patchPollersByIdResume")
            .that.is.a("function").with.length(1);
        });

        it("Run patchPollersByIdResume", function() {
            var mockPoller = [{
                id: "4532",
                name: "Pollers.IPMI",
                config: {},
                paused: "false"
            }];
            waterline.workitems.updateByIdentifier.resolves(mockPoller);
            return pollerService.patchPollersByIdResume().then(function (pollers) {
                expect(pollers).to.deep.equal(mockPoller);
            });
        });
    });

    describe("deletePollersById", function() {
        it("should expose the appropriate methods", function() {
            pollerService.should.have.property("deletePollersById")
            .that.is.a("function").with.length(1);
        });
        it("Run deletePollersById", function() {
            var mockDeletedPoller = [];
            waterline.workitems.destroyByIdentifier.resolves(mockDeletedPoller);
            return pollerService.deletePollersById().then(function (pollers) {
                expect(pollers).to.deep.equal(mockDeletedPoller);
            });
        });
    });

    describe("getPollersByIdData", function() {
        it("should expose the appropriate methods", function() {
            pollerService.should.have.property("getPollersByIdData")
            .that.is.a("function").with.length(1);
        });

        it("Run getPollersByIdData", function() {
            var mockPoller = [{
                id: "1234",
                name: "Pollers.IPMI",
                config: {}
            }];


            taskProtocol.requestPollerCache.resolves(mockPoller);

            return pollerService.getPollersByIdData().then(function (pollers) {
                expect(pollers).to.deep.equal(mockPoller);
            });
        });
    });


    describe("getPollersByIdDataCurrent", function() {
        it("should expose the appropriate methods", function() {
            pollerService.should.have.property("getPollersByIdDataCurrent")
            .that.is.a("function").with.length(1);
        });

        it("Run getPollersByIdDataCurrent", function() {
            var mockPoller = [{
                id: "1234",
                name: "Pollers.IPMI",
                config: {}
            }];

            taskProtocol.requestPollerCache.resolves(mockPoller);
            return pollerService.getPollersByIdDataCurrent().then(function (pollers) {
                expect(pollers).to.deep.equal(mockPoller);
            });
        });
    });
});
