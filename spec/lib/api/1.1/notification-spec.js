// Copyright 2016, EMC, Inc.

'use strict';

describe('Http.Api.Notification', function () {
    var notificationApiService;

    var notificationMessage = {
        taskId: '1234abcd5678effe9012dcba',
        data: 'dummy data'
    };

    before('start HTTP server', function () {
        this.timeout(5000);
        return helper.startServer([]);
    });

    beforeEach('set up mocks', function () {
        notificationApiService = helper.injector.get('Http.Services.Api.Notification');
        sinon.stub(notificationApiService, 'postNotification').resolves(notificationMessage);
    });

    afterEach('teardown mocks', function () {
        function resetMocks(obj) {
            _(obj).methods().forEach(function (method) {
                if (typeof obj[method].restore === 'function') {
                    obj[method].restore();
                }
            }).value();
        }
        resetMocks(notificationApiService);
    });

    after('stop HTTP server', function () {
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
    });
});
