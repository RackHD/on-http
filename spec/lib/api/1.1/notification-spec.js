// Copyright 2016, EMC, Inc.

'use strict';

describe('Http.Api.Notification', function () {
    var notificationApiService;

    var nodeNotificationMessage = {
        nodeId: '57a86b5c36ec578876878294',
        randomData: 'random data'
    };

    var broadcastNotificationMessage = {
        data: 'test data'
    };

    before('start HTTP server', function () {
        helper.setupInjector([
             helper.require("/lib/services/notification-api-service.js"),

        ]);
        this.timeout(5000);
        return helper.startServer([]).then(function () {
            notificationApiService = helper.injector.get('Http.Services.Api.Notification');
            sinon.stub(notificationApiService, 'postNodeNotification').resolves(nodeNotificationMessage);
            sinon.stub(notificationApiService, 'postBroadcastNotification').resolves(broadcastNotificationMessage);
        });

    });
    after('stop HTTP server', function () {
        function resetMocks(obj) {
            _(obj).methods().forEach(function (method) {
                if (typeof obj[method].restore === 'function') {
                    obj[method].restore();
                }
            }).value();
        }
        resetMocks(notificationApiService);
        return helper.stopServer();
    });

    describe('POST /notification', function () {
        it('should return node notification detail', function () {
            return helper.request()
            .post('/api/1.1/notification?nodeId='
                + nodeNotificationMessage.nodeId
                + '&randomData='
                + nodeNotificationMessage.randomData)
            .set('Content-Type', 'application/json')
            .expect('Content-Type', /^application\/json/)
            .expect(201, nodeNotificationMessage)
            .then(function () {
                expect(notificationApiService.postNodeNotification).to.have.been.calledOnce;
                expect(notificationApiService.postNodeNotification).to.have.been.calledWith(nodeNotificationMessage);
            });
        });
        it('should return broadcast notification detail', function () {
            return helper.request()
            .post('/api/1.1/notification')
            .send(broadcastNotificationMessage)
            .set('Content-Type', 'application/json')
            .expect('Content-Type', /^application\/json/)
            .expect(201, broadcastNotificationMessage)
            .then(function () {
                expect(notificationApiService.postBroadcastNotification).to.have.been.calledOnce;
                expect(notificationApiService.postBroadcastNotification).to.have.been.calledWith(broadcastNotificationMessage);
            });
        });
        it('should pass with nodeId in query body', function () {
            return helper.request()
            .post('/api/1.1/notification')
            .send({ nodeId: nodeNotificationMessage.nodeId })
            .expect('Content-Type', /^application\/json/)
            .expect(201, nodeNotificationMessage)
        });

        it('should pass with nodeId in query body', function () {
            return helper.request()
            .post('/api/1.1/notification')
            .send(nodeNotificationMessage)
            .expect('Content-Type', /^application\/json/)
            .expect(201, nodeNotificationMessage)
        });
    });
});
