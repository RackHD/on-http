// Copyright 2016, EMC, Inc.

'use strict';

describe('Http.Api.Notification', function () {
    var notificationApiService;
    var eventProtocol;
    var waterline;
    var _;
    var needByIdentifier;
    var postNodeNotification;
    var postBroadcastNotification;
    var TaskGraph;

    var nodeNotificationMessage = {
        nodeId: "57a86b5c36ec578876878294",
        data: 'dummy data'
    };

    var broadcastNotificationMessage = {
        data: 'dummy data'
    };

    var progressNotificationMessage = {
        taskId: "57a86b5c36ec578876878294",
        progress: {
            description: "test",
            percentage: "10%"
        }
    };

    var node = {_id: nodeNotificationMessage.nodeId};

    before('Setup mocks', function () {
        helper.setupInjector([
            onHttpContext.prerequisiteInjectables,
            helper.require("/lib/services/notification-api-service.js"),
        ]);
        notificationApiService = helper.injector.get('Http.Services.Api.Notification');
        _ = helper.injector.get('_');
        eventProtocol = helper.injector.get('Protocol.Events');
        waterline = helper.injector.get('Services.Waterline');
        TaskGraph = helper.injector.get('TaskGraph.TaskGraph');
        waterline.nodes = {
            needByIdentifier: function() {}
        };
        sinon.stub(eventProtocol, 'publishNodeNotification').resolves();
        sinon.stub(eventProtocol, 'publishBroadcastNotification').resolves();
        this.sandbox = sinon.sandbox.create();
        needByIdentifier = sinon.stub(waterline.nodes, 'needByIdentifier');
        needByIdentifier.resolves(node);
        postNodeNotification = sinon.spy(notificationApiService, 'postNodeNotification');
        postBroadcastNotification = sinon.spy(notificationApiService, 'postBroadcastNotification');
    });

    after('Reset mocks', function () {
        function resetMocks(obj) {
            _(obj).methods().forEach(function (method) {
                if (typeof obj[method].restore === 'function') {
                    obj[method].restore();
                }
            }).value();
        }
        resetMocks(eventProtocol);
    });

    describe('POST /notification', function () {
        it('should call postNodeNotification', function () {
            return notificationApiService.postNotification(nodeNotificationMessage)
            .then(function () {
                expect(postNodeNotification).to.have.been.calledOnce;
            });
        });

        it('should call postBroadcastNotification', function () {
            return notificationApiService.postNotification({})
            .then(function () {
                expect(postBroadcastNotification).to.have.been.calledOnce;
            });
        });

        it('should return node notification detail', function () {
            return notificationApiService.postNodeNotification(nodeNotificationMessage)
            .then(function (resp) {
                expect(resp).to.deep.equal(nodeNotificationMessage);
            });
        });

        it('should fail with no nodeId', function () {
            return notificationApiService.postNodeNotification(_.omit(nodeNotificationMessage, 'nodeId'))
            .then(function (done) {
                done(new Error("Expected service to fail"));
            })
            .catch(function (e) {
                expect(e).to.have.property('message').that.equals('Invalid node ID in query or body');
            });
        });

        it('should fail with nodeId that is not a string', function () {
            return notificationApiService.postNodeNotification(_.assign({}, nodeNotificationMessage, {nodeId: {data: "I am an object"}}))
            .then(function (done) {
                done(new Error("Expected service to fail"));
            })
            .catch(function (e) {
                expect(e).to.have.property('message').that.equals('Invalid node ID in query or body');
            });
        });

        it('should fail with non-exist node', function () {
            needByIdentifier.resolves();
            return notificationApiService.postNodeNotification(nodeNotificationMessage)
            .then(function (done) {
                done(new Error("Expected service to fail"));
            })
            .catch(function (e) {
                expect(e).to.have.property('message').that.equals('Node not found');
            });
        });

        it('should return post broadcast notification', function () {
            return notificationApiService.postBroadcastNotification(broadcastNotificationMessage)
            .then(function (resp) {
                expect(resp).to.deep.equal(broadcastNotificationMessage);
            });
        });

        it('should update graph progress', function () {
            var tasks = [{graphId: "graphId"}],
                graphs = [{
                    instanceId: "graphId",
                    definition: {friendlyName: "Test Graph"},
                    tasks: {"57a86b5c36ec578876878294": {friendlyName: "Test Task"}}
                }],
                progressData = {
                    graphId: graphs[0].instanceId,
                    graphName: graphs[0].definition.friendlyName,
                    progress: {
                        percentage: "na",
                        description: progressNotificationMessage.progress.description
                    },
                    taskProgress: {
                        graphId: graphs[0].instanceId,
                        taskId: progressNotificationMessage.taskId,
                        taskName: graphs[0].tasks[progressNotificationMessage.taskId].friendlyName,
                        progress: progressNotificationMessage.progress
                    }
                };
            waterline.taskdependencies = {find: function() {}};
            waterline.graphobjects = {find: function() {}};
            this.sandbox.stub(waterline.taskdependencies, 'find').resolves(tasks);
            this.sandbox.stub(waterline.graphobjects, 'find').resolves(graphs);
            this.sandbox.stub(TaskGraph.prototype, 'updateGraphProgress').resolves();
            return notificationApiService.postProgressEvent(progressNotificationMessage)
            .then(function () {
                expect(waterline.taskdependencies.find).to.be.calledOnce;
                expect(waterline.taskdependencies.find).to.be.calledWith({
                    taskId: progressNotificationMessage.taskId});
                expect(waterline.graphobjects.find).to.be.calledOnce;
                expect(waterline.graphobjects.find).to.be.calledWith({
                    instanceId: tasks[0].graphId});
                expect(TaskGraph.prototype.updateGraphProgress).to.be.calledOnce;
                expect(TaskGraph.prototype.updateGraphProgress).to.be.calledWith(progressData);
            });
        });

        it('should not update graph progress', function () {
            this.sandbox.restore();
            waterline.taskdependencies = {find: function() {}};
            waterline.graphobjects = {find: function() {}};
            this.sandbox.stub(waterline.taskdependencies, 'find').resolves([]);
            this.sandbox.spy(waterline.graphobjects, 'find');
            this.sandbox.spy(TaskGraph.prototype, 'updateGraphProgress');
            return notificationApiService.postProgressEvent({taskId: 'aTask'})
            .then(function () {
                expect(waterline.taskdependencies.find).to.be.calledOnce;
                expect(waterline.graphobjects.find).to.have.not.been.called;
                expect(TaskGraph.prototype.updateGraphProgress).to.have.not.been.called;
            });
        });

        it('should call postProgressEvent', function () {
            sinon.stub(notificationApiService, 'postProgressEvent').resolves();
            return notificationApiService.postNotification(progressNotificationMessage)
            .then(function () {
                expect(notificationApiService.postProgressEvent).to.be.calledOnce;
                expect(notificationApiService.postProgressEvent).to.be
                    .calledWith(progressNotificationMessage);
            });
        });

    });
});
