// Copyright © 2016-2017 Dell Inc. or its subsidiaries.  All Rights Reserved.

'use strict';

describe('Http.Api.Notification', function () {
    var notificationApiService;
    var eventsProtocol;
    var waterline;
    var _;
    var needByIdentifier;
    var postNodeNotification;
    var postBroadcastNotification;

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
            maximum: "100",
            value: "10",
            percentage: "100%"
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
        eventsProtocol = helper.injector.get('Protocol.Events');
        waterline = helper.injector.get('Services.Waterline');
        waterline.nodes = {
            needByIdentifier: function() {}
        };
        sinon.stub(eventsProtocol, 'publishNodeNotification').resolves();
        sinon.stub(eventsProtocol, 'publishBroadcastNotification').resolves();
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
        resetMocks(eventsProtocol);
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

        it('should call postProgressNotification', function () {
            this.sandbox.stub(notificationApiService, 'postProgressNotification').resolves();
            return notificationApiService.postNotification(progressData)
            .then(function () {
                expect(notificationApiService.postProgressNotification).to.have.been.calledOnce;
                expect(notificationApiService.postProgressNotification)
                    .to.have.been.calledWith(progressData.taskId, progressData.progress);
            });
        });

        it('should update graph progress percentage', function () {
            var task = {graphId: 'graphId'},
                graph = {
                    instanceId: 'graphId',
                    name: 'Test Graph',
                    node: 'nodeId',
                    tasks: {'57a86b5c36ec578876878294': {friendlyName: 'Test Task'}}
                },
                data = {
                    graphId: graph.instanceId,
                    graphName: graph.name,
                    nodeId: 'nodeId',
                    progress: {
                        maximum: 1,
                        value: 1,
                        percentage: '100%',
                        description: progressData.progress.description
                    },
                    taskProgress: {
                        taskId: progressData.taskId,
                        taskName: graph.tasks[progressData.taskId].friendlyName,
                        progress: progressData.progress
                    }
                };
            this.sandbox.restore();
            waterline.taskdependencies = {findOne: function() {}};
            waterline.graphobjects = {findOne: function() {}};
            this.sandbox.stub(waterline.taskdependencies, 'findOne').resolves(task);
            this.sandbox.stub(waterline.graphobjects, 'findOne').resolves(graph);
            this.sandbox.stub(eventsProtocol, 'publishProgressEvent').resolves();
            return notificationApiService.postProgressNotification(progressData.taskId,
                                                                   progressData.progress)
            .then(function () {
                expect(waterline.taskdependencies.findOne).to.be.calledOnce;
                expect(waterline.taskdependencies.findOne).to.be.calledWith({
                    taskId: progressData.taskId});
                expect(waterline.graphobjects.findOne).to.be.calledOnce;
                expect(waterline.graphobjects.findOne).to.be.calledWith({
                    instanceId: task.graphId});
                expect(eventsProtocol.publishProgressEvent).to.be.calledOnce;
                expect(eventsProtocol.publishProgressEvent)
                    .to.be.calledWith(graph.instanceId, data);
            });
        });

        it('should not update graph progress if no active task found', function () {
            this.sandbox.restore();
            waterline.taskdependencies = {findOne: function() {}};
            waterline.graphobjects = {findOne: function() {}};
            this.sandbox.stub(waterline.taskdependencies, 'findOne').resolves([]);
            this.sandbox.spy(waterline.graphobjects, 'findOne');
            this.sandbox.spy(eventsProtocol, 'publishProgressEvent');
            return expect(
                notificationApiService.postProgressNotification(
                    progressData.taskId,
                    progressData.progress
                )
            ).to.be.rejected;
        });

        it('should not update graph progress if can not fnd graph object', function () {
            var task = {graphId: "graphId"};
            this.sandbox.restore();
            waterline.taskdependencies = {findOne: function() {}};
            waterline.graphobjects = {findOne: function() {}};
            this.sandbox.stub(waterline.taskdependencies, 'findOne').resolves(task);
            this.sandbox.stub(waterline.graphobjects, 'findOne').resolves({});
            this.sandbox.spy(eventsProtocol, 'publishProgressEvent');
            return expect(
                notificationApiService.postProgressNotification(progressData.taskId, {})
            ).to.be.rejected;
        });

    });
});
