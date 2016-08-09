// Copyright 2016, EMC, Inc.

'use strict';

describe('Http.Api.Notification', function () {
    var notificationApiService;

    var notificationMessage = {
        taskId: '1234abcd5678effe9012dcba',
        data: 'dummy data'
    };

    before('start HTTP server', function () {
        helper.setupInjector([
             helper.require("/lib/services/notification-api-service.js"),

        ]);
        this.timeout(5000);
        return helper.startServer([]).then(function () {
            notificationApiService = helper.injector.get('Http.Services.Api.Notification');
            sinon.stub(notificationApiService, 'postNotification').resolves(notificationMessage);
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
        it('should return notification detail', function () {
            return helper.request()
            .post(
                '/api/1.1/notification?taskId='
                + notificationMessage.taskId
                + '&data='
                + notificationMessage.data)
            .set('Content-Type', 'application/json')
            .expect('Content-Type', /^application\/json/)
            .expect(201, notificationMessage)
            .then(function () {
                expect(notificationApiService.postNotification).to.have.been.calledOnce;
                expect(notificationApiService.postNotification).to.have.been.calledWith(notificationMessage);
            });
        });
        it('should pass with taskId in query body', function () {
            return helper.request()
            .post('/api/1.1/notification?data=' + notificationMessage.data)
            .send({ taskId: notificationMessage.taskId })
            .expect('Content-Type', /^application\/json/)
            .expect(201, notificationMessage)
        });

        it('should pass with data in query body', function () {
            return helper.request()
            .post('/api/1.1/notification?taskId=' + notificationMessage.taskId)
            .send({ data: notificationMessage.data })
            .expect('Content-Type', /^application\/json/)
            .expect(201, notificationMessage)
        });

        it('should pass with data as an object in query body', function () {
            return helper.request()
            .post('/api/1.1/notification?taskId=' + notificationMessage.taskId)
            .send(notificationMessage)
            .expect('Content-Type', /^application\/json/)
            .expect(201, notificationMessage)
        });
    });
});
