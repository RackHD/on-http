// Copyright 2015, EMC, Inc.
/* jshint node:true */

"use strict";

describe("Http.Services.Api.Profiles", function () {
    var profileApiService;
    var Errors;
    var taskProtocol;
    var taskGraphProtocol;
    var eventsProtocol;
    var waterline;

    before("Http.Services.Api.Profiles before", function() {
        helper.setupInjector([
            helper.require("/lib/services/profiles-api-service")
        ]);
        profileApiService = helper.injector.get("Http.Services.Api.Profiles");
        Errors = helper.injector.get("Errors");
        waterline = helper.injector.get('Services.Waterline');
        waterline.nodes = {
            findByIdentifier: function() {}
        };
        taskProtocol = helper.injector.get("Protocol.Task");
        taskGraphProtocol = helper.injector.get("Protocol.TaskGraphRunner");
        eventsProtocol = helper.injector.get("Protocol.Events");
    });

    beforeEach("Http.Services.Api.Profiles beforeEach", function() {
        this.sandbox = sinon.sandbox.create();
    });

    afterEach("Http.Services.Api.Profiles afterEach", function() {
        this.sandbox.restore();
    });

    it("waitForDiscoveryStart should retry twice if task is not initially online", function() {
        this.sandbox.stub(taskProtocol, 'requestProperties');
        taskProtocol.requestProperties.onFirstCall().rejects(new Errors.RequestTimedOutError(""));
        taskProtocol.requestProperties.onSecondCall().rejects(new Errors.RequestTimedOutError(""));
        taskProtocol.requestProperties.onThirdCall().resolves();

        return profileApiService.waitForDiscoveryStart("testnodeid")
        .then(function() {
            expect(taskProtocol.requestProperties).to.have.been.calledThrice;
        });
    });

    describe("getNode", function() {
        var node;

        before("getNode before", function() {
            node = {
                discovered: sinon.stub()
            };
        });

        beforeEach(function() {
            node.discovered.rejects(new Error('override in test'));
            node.discovered.reset();
        });

        it("getNode should create a new node and run discovery", function() {
            this.sandbox.stub(waterline.nodes, 'findByIdentifier').resolves(undefined);
            this.sandbox.stub(profileApiService, 'createNodeAndRunDiscovery').resolves();
            return profileApiService.getNode('testmac')
            .then(function() {
                expect(profileApiService.createNodeAndRunDiscovery)
                    .to.have.been.calledWith('testmac');
            });
        });

        it("getNode should run discovery for a pre-existing node with no catalogs", function() {
            var node = {
                discovered: sinon.stub().resolves(false)
            };
            this.sandbox.stub(waterline.nodes, 'findByIdentifier').resolves(node);
            this.sandbox.stub(taskProtocol, 'activeTaskExists').rejects(new Error(''));
            this.sandbox.stub(profileApiService, 'runDiscovery').resolves();

            return profileApiService.getNode('testmac')
            .then(function() {
                expect(profileApiService.runDiscovery).to.have.been.calledWith(node);
            });
        });

        it("getNode should do nothing for a node with an active discovery workflow", function() {
            node.discovered.resolves(false);
            this.sandbox.stub(waterline.nodes, 'findByIdentifier').resolves(node);
            this.sandbox.stub(taskProtocol, 'activeTaskExists').resolves();
            this.sandbox.stub(profileApiService, 'runDiscovery').resolves();

            return expect(profileApiService.getNode('testmac')).to.become(node);
        });

        it("getNode should do nothing for a node with an active discovery workflow", function() {
            node.discovered.resolves(false);
            this.sandbox.stub(waterline.nodes, 'findByIdentifier').resolves(node);
            this.sandbox.stub(taskProtocol, 'activeTaskExists').resolves();
            this.sandbox.stub(profileApiService, 'runDiscovery').resolves();

            return expect(profileApiService.getNode('testmac')).to.become(node);
        });

        it("getNode should do nothing for a node that has already been discovered", function() {
            node.discovered.resolves(true);
            this.sandbox.stub(waterline.nodes, 'findByIdentifier').resolves(node);

            return expect(profileApiService.getNode('testmac')).to.become(node);
        });
    });

    describe("runDiscovery", function() {
        afterEach(function() {
            profileApiService.activeNodeGraphs = 0;
        });

        it("should fail if activeNodeGraphs >= maxNodeGraphs", function() {
            profileApiService.activeNodeGraphs = profileApiService.maxNodeGraphs;

            return expect(profileApiService.runDiscovery('testnode'))
                        .to.be.rejectedWith(Errors.MaxGraphsRunningError);
        });

        it("should increment active node graphs", function() {
            this.sandbox.stub(taskGraphProtocol, 'runTaskGraph').resolves({ instanceId: 'foo' });
            this.sandbox.stub(eventsProtocol, 'subscribeGraphFinished').resolves();
            this.sandbox.stub(profileApiService, 'waitForDiscoveryStart').resolves();

            var oldActiveGraphs = profileApiService.activeNodeGraphs;
            return profileApiService.runDiscovery({ id: 'bar' }).then(function() {
                expect(profileApiService.activeNodeGraphs).to.equal(oldActiveGraphs + 1);
            });
        });

        it("should decrement completed node graphs", function() {
            this.sandbox.stub(taskGraphProtocol, 'runTaskGraph').resolves({ instanceId: 'foo' });
            this.sandbox.stub(eventsProtocol, 'subscribeGraphFinished').resolves();
            this.sandbox.stub(profileApiService, 'waitForDiscoveryStart').resolves();

            var oldActiveGraphs = profileApiService.activeNodeGraphs;
            return profileApiService.runDiscovery({ id: 'bar' }).then(function() {
                expect(profileApiService.activeNodeGraphs).to.equal(oldActiveGraphs + 1);
            });
        });

        it("should decrement on failure to run a taskgraph", function() {
            this.sandbox.stub(taskGraphProtocol, 'runTaskGraph').rejects(new Error());
            var oldActiveGraphs = profileApiService.activeNodeGraphs;

            return expect(profileApiService.runDiscovery({ id: 'bar' }))
                        .to.be.rejected
                        .then(function() {
                            expect(profileApiService.activeNodeGraphs).to.equal(oldActiveGraphs);
                        });
        });

        it("should decrement on completion of a taskgraph", function() {
            this.sandbox.stub(taskGraphProtocol, 'runTaskGraph').resolves({ instanceId: 'foo' });
            this.sandbox.stub(eventsProtocol, 'subscribeGraphFinished').resolves();
            this.sandbox.stub(profileApiService, 'waitForDiscoveryStart').resolves();
            var oldActiveGraphs = profileApiService.activeNodeGraphs;

            return profileApiService.runDiscovery({ id: 'bar' }).then(function() {
                var cb = eventsProtocol.subscribeGraphFinished.firstCall.args[1];
                expect(profileApiService.activeNodeGraphs).to.equal(oldActiveGraphs + 1);
                cb();
                expect(profileApiService.activeNodeGraphs).to.equal(oldActiveGraphs);
            });
        });

        it("should set retryLater:true to the error if the node should retry", function(done) {
            this.sandbox.stub(taskGraphProtocol, 'runTaskGraph').resolves({ instanceId: 'foo' });
            this.sandbox.stub(eventsProtocol, 'subscribeGraphFinished').resolves();
            this.sandbox.stub(profileApiService, 'waitForDiscoveryStart').resolves();

            profileApiService.maxNodeGraphs = 0;

            return profileApiService.runDiscovery({ id: 'bar' })
            .then(function() {
                done(new Error("Expected runDiscovery to throw MaxGraphsRunningError"));
            })
            .catch(Errors.MaxGraphsRunningError, function() {
                return profileApiService.runDiscovery({ id: 'bar' });
            })
            .catch(Errors.MaxGraphsRunningError, function(error) {
                expect(profileApiService.nodesRetrying).to.have.property('bar').that.equals(true);
                expect(error).to.have.property('retryLater').that.equals(true);
                done();
            })
            .catch(function(err) {
                done(err);
            });
        });

        it("should delete node from nodesRetrying once the server " +
                "can discover it", function(done) {
            this.sandbox.stub(taskGraphProtocol, 'runTaskGraph').resolves({ instanceId: 'foo' });
            this.sandbox.stub(eventsProtocol, 'subscribeGraphFinished').resolves();
            this.sandbox.stub(profileApiService, 'waitForDiscoveryStart').resolves();

            profileApiService.maxNodeGraphs = 0;
            profileApiService.nodesRetrying = {};

            return profileApiService.runDiscovery({ id: 'bar' })
            .then(function() {
                done(new Error("Expected runDiscovery to throw MaxGraphsRunningError"));
            })
            .catch(Errors.MaxGraphsRunningError, function() {
                profileApiService.maxNodeGraphs = 1;
                return profileApiService.runDiscovery({ id: 'bar' });
            })
            .then(function() {
                expect(profileApiService.nodesRetrying).to.be.empty;
                done();
            })
            .catch(function(err) {
                done(err);
            });
        });
    });
});
