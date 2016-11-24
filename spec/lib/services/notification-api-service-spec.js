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

    var progressData = {
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
            return notificationApiService.postNodeNotification(_.omit(nodeNotificationMessage,
                                                                      'nodeId'))
            .then(function (done) {
                done(new Error("Expected service to fail"));
            })
            .catch(function (e) {
                expect(e).to.have.property('message').that.equals(
                    'Invalid node ID in query or body');
            });
        });

        it('should fail with nodeId that is not a string', function () {
            return notificationApiService.postNodeNotification(
                _.assign({}, nodeNotificationMessage, {nodeId: {data: "I am an object"}}))
            .then(function (done) {
                done(new Error("Expected service to fail"));
            })
            .catch(function (e) {
                expect(e).to.have.property('message').that.equals(
                    'Invalid node ID in query or body');
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

        it('should update graph progress percentage', function () {
            var tasks = {graphId: "graphId"},
                graphs = {
                    instanceId: "graphId",
                    definition: {friendlyName: "Test Graph"},
                    tasks: {"57a86b5c36ec578876878294": {friendlyName: "Test Task"}}
                },
                data = {
                    graphId: graphs.instanceId,
                    graphName: graphs.definition.friendlyName,
                    progress: {
                        percentage: null,
                        description: progressData.progress.description
                    },
                    taskProgress: {
                        //graphId: graphs.instanceId,
                        taskId: progressData.taskId,
                        taskName: graphs.tasks[progressData.taskId].friendlyName,
                        progress: progressData.progress
                    }
                };
            waterline.taskdependencies = {findOne: function() {}};
            waterline.graphobjects = {findOne: function() {}};
            this.sandbox.stub(waterline.taskdependencies, 'findOne').resolves(tasks);
            this.sandbox.stub(waterline.graphobjects, 'findOne').resolves(graphs);
            this.sandbox.stub(TaskGraph, 'updateGraphProgress').resolves();
            return notificationApiService.postProgressNotification(progressData.taskId,
                                                                   progressData.progress)
            .then(function () {
                expect(waterline.taskdependencies.findOne).to.be.calledOnce;
                expect(waterline.taskdependencies.findOne).to.be.calledWith({
                    taskId: progressData.taskId});
                expect(waterline.graphobjects.findOne).to.be.calledOnce;
                expect(waterline.graphobjects.findOne).to.be.calledWith({
                    instanceId: tasks.graphId});
                expect(TaskGraph.updateGraphProgress).to.be.calledOnce;
                expect(TaskGraph.updateGraphProgress).to.be.calledWith(data);
            });
        });

        it('should update graph progress with steps', function () {
            var tasks = {graphId: "graphId"},
                progressMessage = {
                    taskId: "57a86b5c36ec578876878294",
                    progress: {totalSteps: 5, currentStep: '2'}
                },
                graphs = {
                    instanceId: "graphId",
                    definition: {friendlyName: "Test Graph"},
                    tasks: {"57a86b5c36ec578876878294": {friendlyName: "Test Task"}}
                },
                progressData = {
                    graphId: graphs.instanceId,
                    graphName: graphs.definition.friendlyName,
                    progress: {
                        percentage: null,
                        description: ""
                    },
                    taskProgress: {
                        //graphId: graphs.instanceId,
                        taskId: progressMessage.taskId,
                        taskName: graphs.tasks[progressMessage.taskId].friendlyName,
                        progress: {progressRate: "2/5"}
                    }
                };
            this.sandbox.restore();
            waterline.taskdependencies = {findOne: function() {}};
            waterline.graphobjects = {findOne: function() {}};
            this.sandbox.stub(waterline.taskdependencies, 'findOne').resolves(tasks);
            this.sandbox.stub(waterline.graphobjects, 'findOne').resolves(graphs);
            this.sandbox.stub(TaskGraph, 'updateGraphProgress').resolves();
            return notificationApiService.postProgressNotification(progressMessage.taskId,
                                                                   progressMessage.progress)
            .then(function () {
                expect(TaskGraph.updateGraphProgress).to.be.calledOnce;
                expect(TaskGraph.updateGraphProgress).to.be.calledWith(progressData);
            });
        });

        it('should not update graph progress if no active task found', function () {
            this.sandbox.restore();
            waterline.taskdependencies = {findOne: function() {}};
            waterline.graphobjects = {findOne: function() {}};
            this.sandbox.stub(waterline.taskdependencies, 'findOne').resolves([]);
            this.sandbox.spy(waterline.graphobjects, 'findOne');
            this.sandbox.spy(TaskGraph, 'updateGraphProgress');
            return notificationApiService.postProgressNotification(progressData.taskId,
                                                                   progressData.progress)
            .then(function () {
                expect(waterline.taskdependencies.findOne).to.be.calledOnce;
                expect(waterline.graphobjects.findOne).to.have.not.been.called;
                expect(TaskGraph.updateGraphProgress).to.have.not.been.called;
            });
        });

        it('should not update graph progress if not enough  info in progress data', function () {
            var tasks = {graphId: "graphId"};
            this.sandbox.restore();
            waterline.taskdependencies = {findOne: function() {}};
            waterline.graphobjects = {findOne: function() {}};
            this.sandbox.stub(waterline.taskdependencies, 'findOne').resolves(tasks);
            this.sandbox.stub(waterline.graphobjects, 'findOne').resolves();
            this.sandbox.spy(TaskGraph, 'updateGraphProgress');
            return notificationApiService.postProgressNotification(progressData.taskId, {})
            .then(function () {
                expect(waterline.taskdependencies.findOne).to.be.calledOnce;
                expect(waterline.graphobjects.findOne).to.have.been.called;
                expect(TaskGraph.updateGraphProgress).to.have.not.been.called;
            });
        });

        it('should call postProgressNotification', function () {
            sinon.stub(notificationApiService, 'postProgressNotification').resolves();
            return notificationApiService.postNotification(progressData)
            .then(function () {
                expect(notificationApiService.postProgressNotification).to.be.calledOnce;
                expect(notificationApiService.postProgressNotification).to.be
                    .calledWith(progressData.taskId, progressData.progress);
            });
        });

    });
});
