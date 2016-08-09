// Copyright 2016, EMC, Inc.

'use strict';

describe('Http.Api.Notification', function () {
    var notificationApiService;
    var taskProtocol;
    var eventProtocol;

    var notificationMessage = {
        taskId: "73b8ca01-735b-40d6-897a-7003ef2fa988",
        data: 'dummy data'
    };

    var activeTask = {
        taskId: notificationMessage.taskId,
    };

    before('start HTTP server', function () {
        helper.setupInjector([
            helper.require("/lib/services/notification-api-service.js")
        ]);
        notificationApiService = helper.injector.get('Http.Services.Api.Notification');
        taskProtocol = helper.injector.get('Protocol.Task');
        eventProtocol = helper.injector.get('Protocol.Events');
        sinon.stub(taskProtocol, 'activeTaskExists').resolves(activeTask);
        sinon.stub(eventProtocol, 'publishTaskNotification').resolves();
    });

    after('stop HTTP server', function () {
        function resetMocks(obj) {
            _(obj).methods().forEach(function (method) {
                if (typeof obj[method].restore === 'function') {
                    obj[method].restore();
                }
            }).value();
        }
        resetMocks(taskProtocol);
        resetMocks(eventProtocol);
    });

    describe('POST /notification', function () {
        it('should return notification detail', function () {
            return notificationApiService.postNotification(notificationMessage)
            .then(function (resp) {
                expect(resp).to.deep.equal(notificationMessage);
            });
        });

        it('should fail with no taskId in query parameter', function () {
            notificationMessage = {
                data: 'dummy data'
            };
            return notificationApiService.postNotification(notificationMessage)
            .then(function (done) {
                done(new Error("Expected service to fail"));
            })
            .catch(function (e) {
                expect(e).to.have.property('message').that.equals('Missing task ID in query or body');
            });
        });

        it('should fail with no data in query parameter', function () {
            notificationMessage = {
                taskId: "73b8ca01-735b-40d6-897a-7003ef2fa988"
            };
            return notificationApiService.postNotification(notificationMessage)
            .then(function (done) {
                done(new Error("Expected service to fail"));
            })
            .catch(function (e) {
                expect(e).to.have.property('message').that.equals('Missing notification data in query or body');
            });
        });
    });
});
